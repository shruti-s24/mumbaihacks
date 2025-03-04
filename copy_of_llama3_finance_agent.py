# -*- coding: utf-8 -*-
"""Copy of LLaMa3-Finance-Agent.ipynb

Automatically generated by Colab.

Original file is located at
    https://colab.research.google.com/drive/13-WvQRR5nK3cDzwbW1xEEAOrevk5Qpzf
"""

# Commented out IPython magic to ensure Python compatibility.
# %%capture
# # Installs Unsloth, Xformers (Flash Attention) and all other packages
# !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
# !pip install --no-deps xformers trl peft accelerate bitsandbytes
# !pip install sec_api
# !pip install -U langchain
# !pip install -U langchain-community
# !pip install -U sentence-transformers
# !pip install -U faiss-gpu

# HuggingFace token, required for accessing gated models (like LLaMa 3 8B Instruct)
hf_token = "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"
# SEC-API Key
sec_api_key = "740a137cbb26e0757df94bc725622edc710f9225a19f5e1a9c40caa60a2e4008"

# Fine Tuning Related Packages
from unsloth import FastLanguageModel
import torch
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments
from unsloth import is_bfloat16_supported

# Pipeline & RAG Related Packages
from sec_api import ExtractorApi, QueryApi
from langchain.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Load the model and tokenizer from the pre-trained FastLanguageModel
model, tokenizer = FastLanguageModel.from_pretrained(
    # Specify the pre-trained model to use
    model_name = "meta-llama/Meta-Llama-3-8B-Instruct",
    # Specifies the maximum number of tokens (words or subwords) that the model can process in a single forward pass
    max_seq_length = 2048,
    # Data type for the model. None means auto-detection based on hardware, Float16 for specific hardware like Tesla T4
    dtype = None,
    # Enable 4-bit quantization, By quantizing the weights of the model to 4 bits instead of the usual 16 or 32 bits, the memory required to store these weights is significantly reduced. This allows larger models to be run on hardware with limited memory resources.
    load_in_4bit = True,
    # Access token for gated models, required for authentication to use models like Meta-Llama-2-7b-hf
    token = hf_token,
)

trainer_stats = trainer.train()

model.save_pretrained("/content/drive/MyDrive/l3_finagent/l3_finagent_step60") # Local saving
tokenizer.save_pretrained("/content/drive/MyDrive/l3_finagent/l3_finagent_step60")

# Main Inference Function, handles generating and decoding tokens
def inference(question, context):
  inputs = tokenizer(
  [
      ft_prompt.format(
          question,
          context,
          "", # output - leave this blank for generation!
      )
  ], return_tensors = "pt").to("cuda")

  # Generate tokens for the input prompt using the model, with a maximum of 64 new tokens.
  # The `use_cache` parameter enables faster generation by reusing previously computed values.
  # The `pad_token_id` is set to the EOS token to handle padding properly.
  outputs = model.generate(**inputs, max_new_tokens = 64, use_cache = True, pad_token_id=tokenizer.eos_token_id)
  response = tokenizer.batch_decode(outputs) # Decoding tokens into english words
  return response

# Function for extracting just the language model generation from the full response
def extract_response(text):
    text = text[0]
    start_token = "### Response: <|start_header_id|>assistant<|end_header_id|>"
    end_token = "<|eot_id|>"

    start_index = text.find(start_token) + len(start_token)
    end_index = text.find(end_token, start_index)

    if start_index == -1 or end_index == -1:
        return None

    return text[start_index:end_index].strip()

# Testing it out!
context = "The increase in research and development expense for fiscal year 2023 was primarily driven by increased compensation, employee growth, engineering development costs, and data center infrastructure."
question = "What were the primary drivers of the notable increase in research and development expenses for fiscal year 2023?"

resp = inference(question, context)
parsed_response = extract_response(resp)
print(parsed_response)

print(resp)

"""---
# **Part 2: Setting Up SEC 10-K Data Pipeline & Retrieval Functionality**

Now that we have our fine tuned language model, inference functions, and a desired prompt format, we need to now set up the RAG pipeline to inject the relevant context into each generation.

The flow will follow as such:

*User Question* -> *Context Retrieval from 10-K* -> *LLM Answers User Question Using Context*

To do this we will need to be able to:
1. Gather specific from 10-K's
2. Parse and chunk the text in them
3. Vectorize and embed the chunks into a vector Database
4. Set up a retriever to semantically search the user's questions over the database to return relevant context

A **Form 10-K** is an annual report required by the U.S. Securities and Exchange Commission, that gives a comprehensive summary of a company's financial performance.
"""

# Extract Filings Function
def get_filings(ticker):
    global sec_api_key

    # Finding Recent Filings with QueryAPI
    queryApi = QueryApi(api_key=sec_api_key)
    query = {
      "query": f"ticker:{ticker} AND formType:\"10-K\"",
      "from": "0",
      "size": "1",
      "sort": [{ "filedAt": { "order": "desc" } }]
    }
    filings = queryApi.get_filings(query)

    # Getting 10-K URL
    filing_url = filings["filings"][0]["linkToFilingDetails"]

    # Extracting Text with ExtractorAPI
    extractorApi = ExtractorApi(api_key=sec_api_key)
    onea_text = extractorApi.get_section(filing_url, "1A", "text") # Section 1A - Risk Factors
    seven_text = extractorApi.get_section(filing_url, "7", "text") # Section 7 - Management’s Discussion and Analysis of Financial Condition and Results of Operations

    # Joining Texts
    combined_text = onea_text + "\n\n" + seven_text

    return combined_text

# HF Model Path
modelPath = "BAAI/bge-large-en-v1.5"
# Create a dictionary with model configuration options, specifying to use the cuda for GPU optimization
model_kwargs = {'device':'cuda'}
encode_kwargs = {'normalize_embeddings': True}

# Initialize an instance of LangChain's HuggingFaceEmbeddings with the specified parameters
embeddings = HuggingFaceEmbeddings(
    model_name=modelPath,     # Provide the pre-trained model's path
    model_kwargs=model_kwargs, # Pass the model configuration options
    encode_kwargs=encode_kwargs # Pass the encoding options
)

# Prompt the user to input the stock ticker they want to analyze
#ticker = input("What Ticker Would you Like to Analyze? ex. AAPL: ")
ticker = "AAPL"

print("-----")
print("Getting Filing Data")
# Retrieve the filing data for the specified ticker
filing_data = get_filings(ticker)

print("-----")
print("Initializing Vector Database")
# Initialize a text splitter to divide the filing data into chunks
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size = 1000,         # Maximum size of each chunk
    chunk_overlap = 500,       # Number of characters to overlap between chunks
    length_function = len,     # Function to determine the length of the chunks
    is_separator_regex = False # Whether the separator is a regex pattern
)
# Split the filing data into smaller, manageable chunks
split_data = text_splitter.create_documents([filing_data])

# Create a FAISS vector database from the split data using embeddings
db = FAISS.from_documents(split_data, embeddings)

# Create a retriever object to search within the vector database
retriever = db.as_retriever()

print("-----")
print("Filing Initialized")

# Retrieval Function
def retrieve_context(query):
    global retriever
    retrieved_docs = retriever.invoke(query) # Invoke the retriever with the query to get relevant documents
    context = []
    for doc in retrieved_docs:
        context.append(doc.page_content) # Collect the content of each retrieved document
    return context

context = retrieve_context("How have currency fluctuations impacted the company's net sales and gross margins?")
print(context)