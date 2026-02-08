from cs50 import get_string
a = get_string("Text: ")
words = 1
letters = 0
sentences = 0
i = 0
while i < len(a):
    if (a[i] == " "):
        words += 1
    if (a[i] == "." or a[i] == "?" or a[i] == "!"):
        sentences += 1
    if (a[i].isalnum()):
        letters += 1
    i += 1

L = (float(letters/words)) * 100
S = (float(sentences/words)) * 100
oup = round(0.0588 * L - 0.296 * S - 15.8)

if (oup < 1):
    print("Before Grade 1")
elif (oup > 16):
    print("Grade 16+")
else:
    print(f"Grade {oup}")
