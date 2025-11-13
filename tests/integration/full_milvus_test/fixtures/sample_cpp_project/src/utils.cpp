#include "utils.h"
#include <algorithm>
#include <cctype>

/**
 * Reverses a string in-place using STL algorithms.
 * This function creates a copy of the input string and reverses it.
 * 
 * @param str The string to reverse
 * @return A new string with characters in reverse order
 * 
 * Example:
 *   reverseString("hello") returns "olleh"
 */
std::string reverseString(const std::string& str) {
    std::string result = str;
    std::reverse(result.begin(), result.end());
    return result;
}

/**
 * Converts all characters in a string to uppercase.
 * Uses the standard toupper function from cctype.
 * 
 * @param str The string to convert
 * @return A new string with all characters in uppercase
 * 
 * Example:
 *   toUpperCase("Hello World") returns "HELLO WORLD"
 */
std::string toUpperCase(const std::string& str) {
    std::string result = str;
    std::transform(result.begin(), result.end(), result.begin(), 
                   [](unsigned char c) { return std::toupper(c); });
    return result;
}

/**
 * Converts all characters in a string to lowercase.
 * Uses the standard tolower function from cctype.
 * 
 * @param str The string to convert
 * @return A new string with all characters in lowercase
 * 
 * Example:
 *   toLowerCase("Hello World") returns "hello world"
 */
std::string toLowerCase(const std::string& str) {
    std::string result = str;
    std::transform(result.begin(), result.end(), result.begin(),
                   [](unsigned char c) { return std::tolower(c); });
    return result;
}

/**
 * Checks if a string is a palindrome.
 * A palindrome reads the same forwards and backwards.
 * 
 * @param str The string to check
 * @return true if the string is a palindrome, false otherwise
 * 
 * Example:
 *   isPalindrome("racecar") returns true
 *   isPalindrome("hello") returns false
 */
bool isPalindrome(const std::string& str) {
    std::string reversed = reverseString(str);
    return str == reversed;
}
