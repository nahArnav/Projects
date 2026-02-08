#include <cs50.h>
#include <stdio.h>
int main(void)
{
    int x;
    do
    {
        x = get_int("Number: ");
    }
    while (x < 1);
    int y = x - 1;
    for (int i = 0; i < x; i++)
    {
        for (int n = y - 1; n >= 0; n--)
        {
            printf(" ");
        }
        for (int j = 0; j < x - y; j++)
        {
            printf("#");
        }
        --y;
        printf("\n");
    }
}
