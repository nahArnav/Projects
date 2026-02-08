#include <cs50.h>
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, string argv[])
{
    if (argc != 2)
    {
        printf("Usage: ./caesar key\n");
        exit(EXIT_FAILURE);
    }
    else if (argc == 2)
    {
        int x = strlen(argv[1]);
        for (int i = 0; i < x; i++)
        {
            if (!(isdigit(argv[1][i])))
            {
                printf("Usage: ./caesar key\n");
                exit(EXIT_FAILURE);
            }
        }
        string inp = get_string("plaintext: ");
        x = strlen(inp);
        int key = atoi(argv[1]);
        printf("ciphertext: ");
        for (int i = 0; i < x; i++)
        {
            if (isalpha(inp[i]))
            {
                char sm = toupper(inp[i]);
                char z = sm + (key % 26);
                if (z <= 'Z')
                {
                    char y = inp[i] + (key % 26);
                    printf("%c", y);
                }
                else
                {
                    int j = (key % 26) - ('Z' - sm) - 1;
                    if (isupper(inp[i]))
                    {
                        printf("%c", 'A' + j);
                    }
                    else if (islower(inp[i]))
                    {
                        printf("%c", 'a' + j);
                    }
                }
            }
            else
            {
                printf("%c", inp[i]);
            }
        }
        printf("\n");
    }
}
