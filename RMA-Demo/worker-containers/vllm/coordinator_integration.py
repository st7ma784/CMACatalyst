"""
Coordinator integration for worker containers
Handles task pulling and result reporting
"""

import os
import time
import requests
from typing import Optional

COORDINATOR_URL = os.getenv("COORDINATOR_URL", "")
WORKER_ID = os.getenv("WORKER_ID", "")
POLL_INTERVAL = 5  # seconds


def pull_tasks() -> list:
    """Pull tasks from coordinator"""
    if not COORDINATOR_URL or not WORKER_ID:
        return []

    try:
        response = requests.get(
            f"{COORDINATOR_URL}/api/worker/tasks",
            params={"worker_id": WORKER_ID},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        return data.get("tasks", [])
    except requests.RequestException as e:
        print(f"⚠️  Failed to pull tasks: {e}")
        return []


def report_task_complete(task_id: str, result: dict):
    """Report task completion to coordinator"""
    if not COORDINATOR_URL or not WORKER_ID:
        return

    try:
        response = requests.post(
            f"{COORDINATOR_URL}/api/worker/task-complete",
            json={
                "worker_id": WORKER_ID,
                "task_id": task_id,
                "result": result
            },
            timeout=10
        )
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"⚠️  Failed to report task completion: {e}")


def main():
    """Main coordination loop"""

    if not COORDINATOR_URL or not WORKER_ID:
        print("⚠️  No coordinator configured, running in standalone mode")
        return

    print(f"✅ Coordinator integration active (Worker ID: {WORKER_ID})")

    while True:
        tasks = pull_tasks()

        for task in tasks:
            print(f"📋 Processing task: {task.get('task_id')}")

            # Task processing handled by main service
            # This is just a placeholder for future task queue implementation

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
