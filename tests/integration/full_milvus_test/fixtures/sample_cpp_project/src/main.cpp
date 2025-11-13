#include <iostream>
#include "utils.h"
#include "config.h"

/**
 * Main entry point for the StringProcessor application.
 * Demonstrates basic string manipulation and configuration usage.
 * 
 * @param argc Argument count
 * @param argv Argument values
 * @return Exit code (0 for success, 1 for error)
 */
int main(int argc, char* argv[]) {
    std::cout << "Application: " << APP_NAME << " v" << APP_VERSION << std::endl;
    
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <input_string>" << std::endl;
        return 1;
    }
    
    std::string input(argv[1]);
    
    // Demonstrate string reversal
    std::string reversed = reverseString(input);
    std::cout << "Original: " << input << std::endl;
    std::cout << "Reversed: " << reversed << std::endl;
    
    // Demonstrate case conversion
    std::string uppercase = toUpperCase(input);
    std::cout << "Uppercase: " << uppercase << std::endl;
    
    // Validate string length
    if (input.length() > MAX_STRING_LENGTH) {
        std::cerr << "Warning: String exceeds maximum length!" << std::endl;
    }
    
    return 0;
}
