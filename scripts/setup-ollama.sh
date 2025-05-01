#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up Ollama for ScreenScore...${NC}\n"

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}Ollama is not installed.${NC}"
    echo "Please install Ollama first:"
    echo "1. Visit https://ollama.com/download"
    echo "2. Download and install Ollama for your operating system"
    echo "3. Run this script again after installation"
    exit 1
fi

# Check if Ollama service is running
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo -e "${RED}Ollama service is not running.${NC}"
    echo "Please start Ollama and run this script again"
    exit 1
fi

# Pull the Mistral model
echo -e "${YELLOW}Pulling Mistral 7B Instruct model...${NC}"
ollama pull mistral:7b-instruct-q4_K_M

# Verify the model was pulled successfully
if ollama list | grep -q "mistral:7b-instruct-q4_K_M"; then
    echo -e "${GREEN}Mistral model installed successfully!${NC}"
else
    echo -e "${RED}Failed to install Mistral model.${NC}"
    echo "Please try running 'ollama pull mistral:7b-instruct-q4_K_M' manually"
    exit 1
fi

echo -e "\n${GREEN}Setup complete! You can now use ScreenScore with local AI analysis.${NC}"
echo "Note: The first analysis might take longer as the model loads into memory." 