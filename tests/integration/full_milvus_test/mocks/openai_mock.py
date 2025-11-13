"""
Mock OpenAI API responses for integration testing.
Only mocks the API calls - all other LightRAG functionality is real.

This mock provides sophisticated entity extraction and query responses
to demonstrate the full LightRAG pipeline with realistic data.
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
import hashlib


class MockOpenAIResponse:
    """Mock OpenAI API responses with pre-recorded or generated data."""
    
    def __init__(self, fixtures_path: Optional[Path] = None):
        self.fixtures_path = fixtures_path
        self.call_count = 0
        self.completion_count = 0
        self.embedding_count = 0
        # Store indexed content for better query responses
        self.indexed_content = []
        
    async def mock_complete(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Mock LLM completion with realistic responses based on prompt content.
        
        OpenAI API calls used by LightRAG:
        1. Chat Completion - For entity extraction and query responses
        2. Embeddings - For vector similarity (handled by mock_embed)
        """
        self.call_count += 1
        self.completion_count += 1
        
        prompt_lower = prompt.lower()
        
        # Store content for later query responses
        if len(prompt) > 100 and not any(keyword in prompt_lower for keyword in ["extract", "query", "search"]):
            self.indexed_content.append(prompt)
        
        # Entity extraction request (detected by system prompt or keywords)
        if system_prompt and "extract" in system_prompt.lower():
            return self._generate_entity_extraction_response(prompt)
        elif "extract" in prompt_lower and ("entit" in prompt_lower or "relationship" in prompt_lower):
            return self._generate_entity_extraction_response(prompt)
        
        # Query/question answering (RAG queries)
        if "?" in prompt or any(word in prompt_lower for word in ["what", "how", "where", "describe", "explain", "list", "show"]):
            return self._generate_query_response(prompt)
        
        # Summary request
        if "summar" in prompt_lower:
            return self._generate_summary_response(prompt)
        
        # Default response
        return "This is a mock LLM response analyzing the provided content."
    
    def _generate_entity_extraction_response(self, prompt: str) -> str:
        """
        Generate entity extraction response from code.
        
        LightRAG expects a specific JSON format with entities and relationships.
        This analyzes the actual code content in the prompt.
        """
        entities = []
        relationships = []
        
        # Extract code patterns from prompt
        prompt_lower = prompt.lower()
        
        # Look for C++ function definitions
        function_pattern = r'(?:std::string|bool|int|void)\s+(\w+)\s*\([^)]*\)'
        functions = re.findall(function_pattern, prompt)
        
        # Look for class/struct definitions
        class_pattern = r'(?:class|struct)\s+(\w+)'
        classes = re.findall(class_pattern, prompt)
        
        # Look for includes
        include_pattern = r'#include\s+[<"]([^>"]+)[>"]'
        includes = re.findall(include_pattern, prompt)
        
        # Extract entities from actual code content
        
        # Functions found in code
        for func in set(functions):
            if func in ["reverseString", "toUpperCase", "toLowerCase", "isPalindrome", "main"]:
                desc = self._get_function_description(func, prompt)
                entities.append({
                    "entity_name": func,
                    "entity_type": "FUNCTION",
                    "description": desc,
                    "source_id": self._determine_source_file(func)
                })
        
        # If no functions found, try keyword detection
        if not entities:
            keywords = {
                "reverseString": "Function that reverses a string using STL reverse algorithm",
                "toUpperCase": "Function that converts string to uppercase using transform and toupper",
                "toLowerCase": "Function that converts string to lowercase using transform and tolower",
                "isPalindrome": "Function that checks if a string is a palindrome",
                "main": "Main entry point that demonstrates string operations",
                "StringProcessor": "Application for string manipulation",
                "utils": "Utility module containing string manipulation functions"
            }
            
            for keyword, desc in keywords.items():
                if keyword.lower() in prompt_lower:
                    entities.append({
                        "entity_name": keyword,
                        "entity_type": "FUNCTION" if keyword != "StringProcessor" else "CLASS",
                        "description": desc,
                        "source_id": self._determine_source_file(keyword)
                    })
        
        # Generate relationships between entities
        # Main function calls utility functions
        entity_names = [e["entity_name"] for e in entities]
        if "main" in entity_names:
            for name in entity_names:
                if name in ["reverseString", "toUpperCase", "toLowerCase"] and "main" in prompt_lower and name.lower() in prompt_lower:
                    relationships.append({
                        "src_id": "main",
                        "tgt_id": name,
                        "description": f"main calls {name} to perform string manipulation",
                        "keywords": "function_call,usage,string_operation",
                        "weight": 0.9
                    })
        
        # isPalindrome uses reverseString
        if "isPalindrome" in entity_names and "reverseString" in entity_names:
            if "ispalindrome" in prompt_lower and "reversestring" in prompt_lower:
                relationships.append({
                    "src_id": "isPalindrome",
                    "tgt_id": "reverseString",
                    "description": "isPalindrome uses reverseString to check if string reads same forwards and backwards",
                    "keywords": "function_call,dependency,string_comparison",
                    "weight": 0.95
                })
        
        # Ensure we have at least one entity
        if not entities:
            entities.append({
                "entity_name": "code_snippet",
                "entity_type": "CODE",
                "description": "Code content related to string processing",
                "source_id": "source"
            })
        
        result = {
            "entities": entities,
            "relationships": relationships
        }
        
        # Return as JSON string (LightRAG will parse this)
        return json.dumps(result, indent=2)
    
    def _get_function_description(self, func_name: str, content: str) -> str:
        """Extract function description from code comments or generate one."""
        descriptions = {
            "reverseString": "Reverses a string in-place using STL algorithms. Creates a copy and reverses it using std::reverse.",
            "toUpperCase": "Converts all characters in a string to uppercase using std::transform and std::toupper.",
            "toLowerCase": "Converts all characters in a string to lowercase using std::transform and std::tolower.",
            "isPalindrome": "Checks if a string is a palindrome by comparing it with its reversed version.",
            "main": "Main entry point for the StringProcessor application. Handles command-line arguments and demonstrates string operations."
        }
        return descriptions.get(func_name, f"Function {func_name} performs string operations")
    
    def _determine_source_file(self, entity_name: str) -> str:
        """Determine source file for an entity."""
        if entity_name == "main":
            return "main.cpp"
        elif entity_name in ["reverseString", "toUpperCase", "toLowerCase", "isPalindrome"]:
            return "utils.cpp"
        else:
            return "source.cpp"
        
        if "stringprocessor" in prompt_lower or "application" in prompt_lower:
            entities.append({
                "entity_name": "StringProcessor",
                "entity_type": "application",
                "description": "Main application for string manipulation operations including reverse, case conversion, and palindrome checking",
                "source_id": "main.cpp"
            })
        
        # Add generic utils entity if we have utils content
        if "util" in prompt_lower and not any(e["entity_name"] in ["utils", "StringUtils"] for e in entities):
            entities.append({
                "entity_name": "StringUtils",
                "entity_type": "module",
                "description": "Utility module containing string manipulation functions",
                "source_id": "utils.cpp"
            })
        
        # Generate relationships
        if len(entities) > 1:
            # Main calls utils functions
            if any(e["entity_name"] == "main" for e in entities):
                for entity in entities:
                    if entity["entity_type"] == "function" and entity["entity_name"] != "main":
                        relationships.append({
                            "src_id": "main",
                            "tgt_id": entity["entity_name"],
                            "description": f"main function calls {entity['entity_name']} for string manipulation",
                            "keywords": "function_call,dependency,usage",
                            "weight": 0.9
                        })
        
        # Always create at least one entity to ensure data is stored
        if not entities:
            entities.append({
                "entity_name": "code_content",
                "entity_type": "content",
                "description": "Source code content with string manipulation functionality",
                "source_id": "source"
            })
        
        result = {
            "entities": entities,
            "relationships": relationships
        }
        
        return json.dumps(result, indent=2)
    
    def _generate_summary_response(self, prompt: str) -> str:
        """Generate summary response."""
        prompt_lower = prompt.lower()
        
        if "stringprocessor" in prompt_lower or "application" in prompt_lower:
            return """The StringProcessor is a C++ application that provides comprehensive string manipulation utilities. The application includes functions for reversing strings (reverseString), converting case to uppercase (toUpperCase) and lowercase (toLowerCase), and checking for palindromes (isPalindrome). The main function serves as the entry point, accepting command-line input and demonstrating all string operations. The architecture consists of a main entry point in main.cpp that orchestrates operations, and a utilities module in utils.cpp containing the core string manipulation functions."""
        
        if "reverse" in prompt_lower:
            return """The reverseString function takes a string input and returns it reversed using STL's std::reverse algorithm. It creates a copy of the input string and reverses it in-place by calling std::reverse on the begin and end iterators."""
        
        if "uppercase" in prompt_lower or "lowercase" in prompt_lower:
            return """The case conversion functions use std::transform with std::toupper/tolower to convert all characters in a string. The toUpperCase function transforms each character to uppercase, while toLowerCase transforms to lowercase. Both create a copy of the input string before transformation."""
        
        if "palindrome" in prompt_lower:
            return """The isPalindrome function checks if a string reads the same forwards and backwards. It accomplishes this by calling reverseString to get the reversed version, then comparing it with the original string for equality."""
        
        return "This C++ codebase implements string manipulation utilities including reversal, case conversion, and palindrome checking using STL algorithms."
    
    def _generate_query_response(self, prompt: str) -> str:
        """Generate intelligent query response based on the question."""
        prompt_lower = prompt.lower()
        
        # Detailed responses based on query type
        
        # Questions about available functions
        if any(word in prompt_lower for word in ["available", "what functions", "list", "functions"]) and "string" in prompt_lower:
            return """The codebase provides the following string manipulation functions:

**Core String Functions:**
1. **reverseString(str)** - Reverses the input string using STL algorithms (std::reverse)
   - Input: const std::string& 
   - Output: std::string
   - Example: reverseString("hello") returns "olleh"

2. **toUpperCase(str)** - Converts all characters to uppercase
   - Uses: std::transform with std::toupper
   - Example: toUpperCase("Hello World") returns "HELLO WORLD"

3. **toLowerCase(str)** - Converts all characters to lowercase
   - Uses: std::transform with std::tolower
   - Example: toLowerCase("Hello World") returns "hello world"

4. **isPalindrome(str)** - Checks if a string is a palindrome
   - Returns: bool (true if palindrome, false otherwise)
   - Example: isPalindrome("racecar") returns true

These functions are defined in utils.cpp and declared in utils.h."""
        
        # Questions about the main function
        if "main" in prompt_lower and any(word in prompt_lower for word in ["function", "what is", "what does"]):
            return """The main function is the entry point for the StringProcessor application. It:

1. **Displays application information** - Shows APP_NAME and APP_VERSION from config.h
2. **Validates input** - Checks if command-line arguments are provided (requires at least 1 argument)
3. **Processes the input string** through multiple operations:
   - Calls reverseString() to demonstrate string reversal
   - Calls toUpperCase() to show case conversion
   - Validates string length against MAX_STRING_LENGTH constant
4. **Provides output** - Displays original, reversed, and uppercase versions
5. **Returns exit code** - 0 for success, 1 for error (missing arguments)

The main function demonstrates practical usage of all utility functions in the codebase."""
        
        # Questions about architecture
        if "architecture" in prompt_lower or "overall" in prompt_lower or "structure" in prompt_lower:
            return """The StringProcessor application follows a modular architecture:

**Component Structure:**
- **main.cpp** - Entry point and CLI interface
  - Handles argument parsing
  - Orchestrates function calls
  - Provides user feedback
  
- **utils.cpp/utils.h** - Core string manipulation library
  - Implements reusable string functions
  - Uses STL algorithms for efficiency
  - Well-documented with examples
  
- **config.h** - Configuration constants
  - APP_NAME, APP_VERSION metadata
  - MAX_STRING_LENGTH limit
  - Feature flags

**Design Pattern:**
The codebase uses a functional programming approach where each utility function is independent and composable. The main function demonstrates this by chaining operations on input strings.

**Dependencies:**
- STL <algorithm> for string manipulation
- STL <iostream> for I/O
- STL <cctype> for character type functions"""
        
        # Questions about how reverseString works
        if "reverse" in prompt_lower and any(word in prompt_lower for word in ["how", "work", "implement"]):
            return """The reverseString function works by:

**Implementation:**
1. Creates a copy of the input string: `std::string result = str;`
2. Uses STL's std::reverse algorithm: `std::reverse(result.begin(), result.end())`
3. Returns the reversed string

**Algorithm Details:**
- Time Complexity: O(n) where n is string length
- Space Complexity: O(n) for the copy
- Uses iterator-based reversal (begin() to end())

**Example Execution:**
```cpp
std::string input = "hello";
std::string reversed = reverseString(input);
// Process: "hello" -> create copy -> reverse in-place -> "olleh"
```

The function leverages STL's std::reverse which swaps characters from both ends moving toward the middle, making it very efficient."""
        
        # Questions about error handling
        if "error" in prompt_lower or "handling" in prompt_lower or "validation" in prompt_lower:
            return """The application includes several error handling mechanisms:

**Input Validation:**
- Checks argc < 2 to ensure command-line argument is provided
- Returns error code 1 with usage message if validation fails

**String Length Validation:**
- Compares input length against MAX_STRING_LENGTH (1024)
- Displays warning if string exceeds maximum length
- Does not crash, only warns

**Return Codes:**
- 0: Successful execution
- 1: Error (missing arguments or invalid input)

**Usage Message:**
Provides clear guidance: `Usage: program_name <input_string>`

The error handling follows C++ best practices with clear error messages and appropriate exit codes."""
        
        # Questions about case conversion
        if "case" in prompt_lower and any(word in prompt_lower for word in ["conversion", "convert", "upper", "lower"]):
            return """Case conversion is handled by two functions:

**toUpperCase(str):**
- Uses std::transform with lambda: `[](unsigned char c) { return std::toupper(c); }`
- Transforms each character in the string to uppercase
- Returns new string with all uppercase characters

**toLowerCase(str):**
- Uses std::transform with lambda: `[](unsigned char c) { return std::tolower(c); }`
- Transforms each character to lowercase
- Returns new string with all lowercase characters

**Why use unsigned char?**
To avoid undefined behavior with non-ASCII characters. The cast ensures proper handling of extended character sets.

**Performance:**
Both functions have O(n) time complexity and create a copy of the input string."""
        
        # Questions about usage or examples
        if "use" in prompt_lower or "example" in prompt_lower or "usage" in prompt_lower:
            return """**Usage Examples:**

**1. String Reversal:**
```cpp
std::string reversed = reverseString("hello");
// Result: "olleh"
```

**2. Case Conversion:**
```cpp
std::string upper = toUpperCase("Hello");  // "HELLO"
std::string lower = toLowerCase("World");  // "world"
```

**3. Palindrome Check:**
```cpp
bool is_palindrome = isPalindrome("racecar");  // true
bool not_palindrome = isPalindrome("hello");   // false
```

**4. Main Application:**
```bash
./string_processor "test"
# Output:
# Application: StringProcessor v1.0.0
# Original: test
# Reversed: tset
# Uppercase: TEST
```

All functions are used in main.cpp to demonstrate the complete workflow."""
        
        # Default detailed response
        return """The StringProcessor application is a C++ utility for string manipulation. It provides four main functions:

1. **reverseString** - Reverses strings using STL's std::reverse
2. **toUpperCase** - Converts to uppercase using std::transform
3. **toLowerCase** - Converts to lowercase using std::transform
4. **isPalindrome** - Checks palindromes by comparing with reversed string

The application demonstrates functional programming with modular, reusable components. The main function in main.cpp serves as the entry point, accepting command-line input and demonstrating all string operations. Core utilities are in utils.cpp/h for reusability."""
    
    async def mock_embed(self, texts: List[str]) -> np.ndarray:
        """
        Mock embedding generation with deterministic vectors.
        Uses hash-based embeddings for reproducibility.
        """
        self.call_count += 1
        self.embedding_count += 1
        
        embeddings = []
        embedding_dim = 1536  # OpenAI text-embedding-3-large dimension
        
        for text in texts:
            # Generate deterministic embedding based on text hash
            text_hash = hashlib.sha256(text.encode()).hexdigest()
            seed = int(text_hash[:8], 16) % (2**32)
            np.random.seed(seed)
            
            # Generate random vector
            embedding = np.random.randn(embedding_dim)
            
            # Normalize to unit length (cosine similarity)
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            
            embeddings.append(embedding)
        
        return np.array(embeddings)


def patch_openai_for_lightrag():
    """
    Create mock functions compatible with LightRAG's expected signatures.
    Returns mock_complete and mock_embed functions.
    """
    mock_client = MockOpenAIResponse()
    
    async def openai_complete_if_cache(
        prompt,
        system_prompt=None,
        history_messages=[],
        **kwargs
    ) -> str:
        """Mock compatible with LightRAG's openai_complete_if_cache."""
        return await mock_client.mock_complete(
            prompt=prompt,
            system_prompt=system_prompt,
            **kwargs
        )
    
    async def openai_embed(texts: List[str], **kwargs) -> np.ndarray:
        """Mock compatible with LightRAG's openai_embed."""
        if isinstance(texts, str):
            texts = [texts]
        return await mock_client.mock_embed(texts)
    
    # Add embedding_dim attribute for Milvus compatibility
    openai_embed.embedding_dim = 1536
    
    return mock_client, openai_complete_if_cache, openai_embed
