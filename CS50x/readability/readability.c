#include <cs50.h>
#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
int read(string y);
int main(void)
{
    string inp = get_string("Text: ");
    int oup = read(inp);
    if (oup < 1)
    {
        printf("Before Grade 1\n");
    }
    else if (oup > 16)
    {
        printf("Grade 16+\n");
    }
    else
    {
        printf("Grade %i\n", oup);
    }
}

int read(string y)
{
    int let = 0;
    int sent = 0;
    int wor = 1;
    int x = strlen(y);
    for (int i = 0; i < x; i++)
    {
        if (y[i] == ' ')
        {
            wor++;
        }
        else if (y[i] == '.' || y[i] == '?' || y[i] == '!')
        {
            sent++;
        }
        else if (isalnum(y[i]))
        {
            let++;
        }
    }
    float L = let / (float) wor * 100;
    float S = sent / (float) wor * 100;
    int index = round(0.0588 * L - 0.296 * S - 15.8);

    return index;
}
