def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)

def greet(name):
    message = "Hello, " + name
    return message

def find_max(arr):
    max_value = arr[0]
    for i in range(1, len(arr)):
        if arr[i] > max_value:
            max_value = arr[i]
    return max_value

def reverse_string(s):
    result = ""
    for i in range(len(s) - 1, -1, -1):
        result += s[i]
    return result

def check_even(num):
    if num % 2 == 0:
        return True
    return False

numbers = [1, 2, 3, 4, 5]
print(calculate_average(numbers))
print(greet("Alice"))
print(find_max(numbers))
print(reverse_string("hello"))
print(check_even(4))
