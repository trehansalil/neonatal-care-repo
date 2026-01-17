import instructor
from instructor import Instructor
from openai import AzureOpenAI, AsyncAzureOpenAI
from .settings import Settings


settings = Settings()

def get_azure_openai_client(mode: instructor.Mode = instructor.Mode.TOOLS) -> Instructor | AzureOpenAI:
    if mode == instructor.Mode.TOOLS:
        client = instructor.from_openai(
            AzureOpenAI(
                azure_endpoint=settings.azure_openai_endpoint, 
                api_key=settings.azure_openai_key,
                api_version=settings.azure_openai_api_version,
            ),
            mode=instructor.Mode.TOOLS
        )
    elif mode == instructor.Mode.JSON:
        client = instructor.from_openai(
            AzureOpenAI(
                azure_endpoint=settings.azure_openai_endpoint, 
                api_key=settings.azure_openai_key,
                api_version=settings.azure_openai_api_version,
            ),
            mode=instructor.Mode.JSON
        )
    elif mode == instructor.Mode.MD_JSON:
        client = instructor.from_openai(
            AzureOpenAI(
                azure_endpoint=settings.azure_openai_endpoint, 
                api_key=settings.azure_openai_key,
                api_version=settings.azure_openai_api_version,
            ),
            mode=instructor.Mode.MD_JSON
        )     
    elif mode == instructor.Mode.PARALLEL_TOOLS:
        client = instructor.from_openai(
            AzureOpenAI(
                azure_endpoint=settings.azure_openai_endpoint, 
                api_key=settings.azure_openai_key,
                api_version=settings.azure_openai_api_version,
            ),
            mode=instructor.Mode.PARALLEL_TOOLS
        )                
    else:
        client = AzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint, 
            api_key=settings.azure_openai_key,
            api_version=settings.azure_openai_api_version,
        )

    return client

