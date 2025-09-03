Hi Claude, 

I want you to check the microservices architecture of the MordecAI advisor tool.

There's a couple of crucial microservices for both OCR and doing document inboxes on a per-client basis. There should also be some services for chatbot support with MCP options for viewing case details. 

First - add features to the client cases tab:
 - There should be a chatbot that can calculate figures, view the case details locally and talk to the advisor, should also be able to query the web for local council things. 
 - It should be hosted by an open-source LLM hosted as part of the app (So LLama? or maybe an alternative?) so that client data isn't being sent to a service provider#
 - This will need MCP endpoints making per client AND a service for LLMS

Second - Review micro services:
 - These services shouldnt incur API costs or defer to other providers, but instead use open-source models, or local deployments. 
 - When run locally these should spin up as their own docker containers 
 - Add guides for registering mail inboxes etc for the inbox upload service. 
 - this should also include the ability to host agents and get them to advise on cases - again - using open-source self hosting via local docker/AWS rather than being reliant on other services. 

Third - Make sure the docs include details of how these work to ensure no data is being sent outside of the deployed software. 


