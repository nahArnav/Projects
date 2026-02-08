while True:
    n = input("Height: ")
    if (n.isdigit()):
        n = int(n)
        if (n < 9) and (n > 0):
            break

for i in range(n):
    print(" " * (n-i-1), end="")
    print("#" * (i + 1))
