from cs50 import get_float
while True:
    n = get_float("Change: ")
    if (n >= 0.0):
        break

n *= 100
count = int(n/25)
n %= 25
count += int(n/10)
n %= 10
count += int(n/5)
n %= 5
count += int(n/1)
print(count)
