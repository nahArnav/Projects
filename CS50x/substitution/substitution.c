#include <cs50.h>
#include <ctype.h>
#include <stdio.h>
#include <string.h>

int main(int argc, string argv[])
{
    if (argc != 2)
    {
        printf("Usage: ./substitution key\n");
        return 1;
    }
    else if (argc == 2)
    {
        int x = strlen(argv[1]);
        if (x == 26)
        {
            for (int i = 0; i < x; i++)
            {
                if (!(isalpha(argv[1][i])))
                {
                    printf("Usage: ./substitution key\n");
                    return 1;
                }
                for (int j = i + 1; j < x; j++)
                {
                    char c1 = tolower(argv[1][i]);
                    char c2 = tolower(argv[1][j]);
                    if (c1 == c2)
                    {
                        printf("Usage: ./substitution key\n");
                        return 1;
                    }
                }
            }
        }
        else
        {
            printf("Usage: ./substitution key\n");
            return 1;
        }
    }
    string inp = get_string("plaintext: ");
    printf("ciphertext: ");
    for (int i = 0; i < strlen(inp); i++)
    {
        char c = inp[i];
        if (isalpha(c))
        {
            int n = 0;
            int m = 0;
            for(int j = 65; j < 91; j++)
            {
                char t = j;
                if(t == c)
                {
                    printf("%c", toupper(argv[1][n]));
                    break;
                }
                n++;
            }
            for(int k = 97; k < 123; k++)
            {
                char t = k;
                if(t == c)
                {
                    printf("%c", tolower(argv[1][m]));
                    break;
                }
                m++;
            }
        }
        else
        {
            printf("%c", c);
        }
    }
    printf("\n");
    return 0;
}
