# StringProcessor - Sample C++ Project

A simple string manipulation utility demonstrating various string operations.

## Features

- **String Reversal**: Reverse any input string
- **Case Conversion**: Convert strings to uppercase or lowercase
- **Palindrome Detection**: Check if a string reads the same forwards and backwards

## Architecture

The application consists of three main components:

1. **main.cpp**: Entry point and command-line interface
2. **utils.cpp/h**: Core string manipulation functions
3. **config.h**: Configuration constants and feature flags

## Usage

```bash
./string_processor "hello world"
```

Output:
```
Application: StringProcessor v1.0.0
Original: hello world
Reversed: dlrow olleh
Uppercase: HELLO WORLD
```

## Functions

### reverseString(str)
Reverses the input string using STL algorithms.

### toUpperCase(str)
Converts all characters to uppercase.

### toLowerCase(str)
Converts all characters to lowercase.

### isPalindrome(str)
Checks if the string is a palindrome.

## Implementation Details

The utility functions leverage C++ STL algorithms for efficient string manipulation:
- `std::reverse` for string reversal
- `std::transform` with `std::toupper/tolower` for case conversion
- String comparison for palindrome detection
