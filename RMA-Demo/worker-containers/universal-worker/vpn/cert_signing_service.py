"""
Certificate Signing Service

FastAPI service that runs on the lighthouse worker to sign certificates
for workers joining the VPN network.

Security:
- Only runs on lighthouse (first worker)
- Rate limited to prevent abuse
- Validates worker requests
- Simple authentication via shared secret
"""

import asyncio
import logging
import os
import time
from typing import Dict, Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import uvicorn

logger = logging.getLogger(__name__)

# Certificate signing configuration
CERT_SERVICE_PORT = 8444
CERT_SERVICE_SECRET = os.getenv("CERT_SERVICE_SECRET", "default-cert-service-secret-CHANGE-ME")
RATE_LIMIT_WINDOW = 60  # seconds
MAX_CERTS_PER_WINDOW = 10  # max certs to sign per minute


class CertificateRequest(BaseModel):
    """Certificate signing request"""
    worker_name: str
    vpn_ip: str  # e.g., "10.42.0.5/16"
    groups: list[str] = ["workers"]


class CertificateResponse(BaseModel):
    """Certificate signing response"""
    worker_crt: str
    worker_key: str
    ca_crt: str


class CertSigningService:
    """
    Certificate signing service for VPN mesh

    Runs on lighthouse worker, signs certificates for joining workers
    """

    def __init__(self, ca_crt: str, ca_key: str, nebula_manager=None):
        """
        Initialize cert signing service

        Args:
            ca_crt: CA certificate PEM string
            ca_key: CA private key PEM string
            nebula_manager: NebulaManager instance (for cert generation)
        """
        self.ca_crt = ca_crt
        self.ca_key = ca_key
        self.nebula_manager = nebula_manager

        # Rate limiting
        self.request_times: list[float] = []
        self.signed_certs: Dict[str, float] = {}  # worker_name -> timestamp

        # FastAPI app
        self.app = FastAPI(
            title="VPN Certificate Signing Service",
            description="Signs worker certificates for VPN mesh network",
            version="1.0.0"
        )

        self._setup_routes()

    def _setup_routes(self):
        """Setup FastAPI routes"""

        @self.app.get("/health")
        async def health():
            """Health check endpoint"""
            return {
                "status": "healthy",
                "service": "cert-signing",
                "certs_signed": len(self.signed_certs),
                "uptime": time.time()
            }

        @self.app.post("/sign", response_model=CertificateResponse)
        async def sign_certificate(
            request: CertificateRequest,
            x_cert_secret: Optional[str] = Header(None)
        ):
            """
            Sign a worker certificate

            Args:
                request: Certificate request with worker details
                x_cert_secret: Authentication secret (header)

            Returns:
                Signed certificate and CA cert
            """
            # Authenticate request
            if x_cert_secret != CERT_SERVICE_SECRET:
                logger.warning(f"Invalid cert signing attempt for {request.worker_name}")
                raise HTTPException(status_code=401, detail="Invalid authentication secret")

            # Rate limiting
            if not self._check_rate_limit():
                logger.warning(f"Rate limit exceeded for cert signing")
                raise HTTPException(status_code=429, detail="Rate limit exceeded, try again later")

            # Validate request
            if not request.worker_name or not request.vpn_ip:
                raise HTTPException(status_code=400, detail="Missing worker_name or vpn_ip")

            # Check if already signed recently (prevent duplicates)
            if request.worker_name in self.signed_certs:
                last_signed = self.signed_certs[request.worker_name]
                if time.time() - last_signed < 300:  # 5 minutes
                    logger.warning(f"Duplicate cert request for {request.worker_name} (too soon)")
                    raise HTTPException(
                        status_code=429,
                        detail="Certificate already signed recently, wait 5 minutes"
                    )

            try:
                logger.info(f"Signing certificate for {request.worker_name} → {request.vpn_ip}")

                # Generate and sign certificate
                worker_crt, worker_key = await self.nebula_manager.generate_worker_cert(
                    ca_crt=self.ca_crt,
                    ca_key=self.ca_key,
                    worker_name=request.worker_name,
                    vpn_ip=request.vpn_ip,
                    groups=request.groups
                )

                # Record signing
                self.signed_certs[request.worker_name] = time.time()
                self.request_times.append(time.time())

                logger.info(f"✅ Signed certificate for {request.worker_name}")

                return CertificateResponse(
                    worker_crt=worker_crt,
                    worker_key=worker_key,
                    ca_crt=self.ca_crt
                )

            except Exception as e:
                logger.error(f"Failed to sign certificate for {request.worker_name}: {e}")
                raise HTTPException(status_code=500, detail=f"Certificate signing failed: {str(e)}")

        @self.app.get("/stats")
        async def get_stats():
            """Get signing service statistics"""
            return {
                "total_certs_signed": len(self.signed_certs),
                "recent_signings": self._get_recent_count(),
                "rate_limit_window": RATE_LIMIT_WINDOW,
                "max_certs_per_window": MAX_CERTS_PER_WINDOW
            }

    def _check_rate_limit(self) -> bool:
        """
        Check if rate limit is exceeded

        Returns:
            True if request is allowed, False if rate limited
        """
        now = time.time()

        # Clean old requests outside window
        self.request_times = [t for t in self.request_times if now - t < RATE_LIMIT_WINDOW]

        # Check limit
        if len(self.request_times) >= MAX_CERTS_PER_WINDOW:
            return False

        return True

    def _get_recent_count(self) -> int:
        """Get count of recent cert signings (last minute)"""
        now = time.time()
        return len([t for t in self.request_times if now - t < 60])

    async def start(self, port: int = CERT_SERVICE_PORT):
        """
        Start certificate signing service

        Args:
            port: Port to listen on (default: 8444)
        """
        logger.info(f"🔐 Starting Certificate Signing Service on port {port}")
        logger.info(f"   Rate limit: {MAX_CERTS_PER_WINDOW} certs per {RATE_LIMIT_WINDOW}s")

        config = uvicorn.Config(
            self.app,
            host="0.0.0.0",
            port=port,
            log_level="info"
        )
        server = uvicorn.Server(config)

        try:
            await server.serve()
        except Exception as e:
            logger.error(f"Cert signing service error: {e}")
            raise


async def request_certificate(
    lighthouse_ip: str,
    worker_name: str,
    vpn_ip: str,
    groups: list[str] = None,
    cert_secret: str = None
) -> tuple[str, str, str]:
    """
    Request a signed certificate from lighthouse

    Args:
        lighthouse_ip: Lighthouse VPN IP or public IP
        worker_name: Name for this worker
        vpn_ip: VPN IP to assign (with CIDR, e.g., "10.42.0.5/16")
        groups: List of groups for the worker
        cert_secret: Authentication secret

    Returns:
        Tuple of (worker_crt, worker_key, ca_crt)
    """
    import httpx

    secret = cert_secret or CERT_SERVICE_SECRET
    groups = groups or ["workers"]

    # Try VPN IP first (if we're already on VPN), fallback to public IP
    urls_to_try = [
        f"http://{lighthouse_ip}:{CERT_SERVICE_PORT}/sign",
    ]

    # If lighthouse_ip looks like a VPN IP, also try with port 8444
    if lighthouse_ip.startswith("10.42."):
        urls_to_try.append(f"http://{lighthouse_ip}:{CERT_SERVICE_PORT}/sign")

    logger.info(f"Requesting certificate from lighthouse: {lighthouse_ip}")

    last_error = None
    for url in urls_to_try:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    json={
                        "worker_name": worker_name,
                        "vpn_ip": vpn_ip,
                        "groups": groups
                    },
                    headers={
                        "X-Cert-Secret": secret
                    }
                )

                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"✅ Received signed certificate from lighthouse")
                    return (
                        result["worker_crt"],
                        result["worker_key"],
                        result["ca_crt"]
                    )
                elif response.status_code == 401:
                    raise Exception("Invalid certificate signing secret")
                elif response.status_code == 429:
                    raise Exception("Rate limited - too many certificate requests")
                else:
                    last_error = f"HTTP {response.status_code}: {response.text}"
                    logger.warning(f"Cert request failed on {url}: {last_error}")

        except httpx.RequestError as e:
            last_error = str(e)
            logger.debug(f"Cert request failed on {url}: {e}")
            continue

    raise Exception(f"Failed to request certificate from lighthouse: {last_error}")


# Example usage
async def main():
    """Test certificate signing service"""
    logging.basicConfig(level=logging.INFO)

    # Mock CA cert and key (in production, these come from bootstrap)
    ca_crt = "-----BEGIN NEBULA CERTIFICATE-----\nMOCK_CA_CERT\n-----END NEBULA CERTIFICATE-----"
    ca_key = "-----BEGIN NEBULA X25519 PRIVATE KEY-----\nMOCK_CA_KEY\n-----END NEBULA X25519 PRIVATE KEY-----"

    # Mock nebula manager
    class MockNebulaManager:
        async def generate_worker_cert(self, ca_crt, ca_key, worker_name, vpn_ip, groups):
            logger.info(f"Mock: Generating cert for {worker_name}")
            return (
                f"-----BEGIN NEBULA CERTIFICATE-----\nMOCK_CERT_{worker_name}\n-----END NEBULA CERTIFICATE-----",
                f"-----BEGIN NEBULA X25519 PRIVATE KEY-----\nMOCK_KEY_{worker_name}\n-----END NEBULA X25519 PRIVATE KEY-----"
            )

    # Start service
    service = CertSigningService(ca_crt, ca_key, MockNebulaManager())

    logger.info("Starting cert signing service on port 8444...")
    logger.info("Test with:")
    logger.info('  curl -X POST http://localhost:8444/sign \\')
    logger.info('    -H "X-Cert-Secret: default-cert-service-secret-CHANGE-ME" \\')
    logger.info('    -H "Content-Type: application/json" \\')
    logger.info('    -d \'{"worker_name": "test-worker", "vpn_ip": "10.42.0.5/16", "groups": ["workers"]}\'')

    await service.start()


if __name__ == "__main__":
    asyncio.run(main())
