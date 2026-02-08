#include <cs50.h>
#include <stdio.h>
int main(void)
{
    int x;
    do
    {
        x = get_int("Change owed: ");
    }
    while (x < 0);
    int counter = 0;
    while (true)
    {
        if (x - 25 >= 0)
        {
            x = x - 25;
            counter++;
            continue;
        }
        else if (x - 10 >= 0)
        {
            x = x - 10;
            counter++;
            continue;
        }
        else if (x - 5 >= 0)
        {
            x = x - 5;
            counter++;
            continue;
        }
        else if (x - 1 >= 0)
        {
            x = x - 1;
            counter++;
            continue;
        }
        else if (x == 0)
        {
            break;
        }
    }
    printf("%i\n", counter);
}
