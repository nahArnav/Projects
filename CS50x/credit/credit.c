#include <cs50.h>
#include <stdio.h>
int main(void)
{
    long num = get_long("Number: ");
    long x = 10;
    long quo = 1;
    long y = 0;
    int counter = 0;
    int checksum = 0;
    long final = 0;
    long z = 1;
    while (quo > 0)
    {
        y = num % x;
        final = y / z;
        quo = num / x;
        if (counter % 2 == 0)
        {
            checksum = checksum + final;
            counter++;
        }
        else if (counter % 2 == 1)
        {
            final = final * 2;
            final = final / 10 + final % 10;
            checksum = checksum + final;
            counter++;
        }
        x = x * 10;
        z = z * 10;
    }
    x = x / 100;
    z = z / 100;
    if (counter == 13)
    {
        if (checksum % 10 == 0 && num / x == 4)
        {
            printf("VISA\n");
        }
        else
        {
            printf("INVALID\n");
        }
    }
    else if (counter == 16)
    {
        if (checksum % 10 == 0 &&
            (num / z == 51 || num / z == 52 || num / z == 53 || num / z == 54 || num / z == 55))
        {
            printf("MASTERCARD\n");
        }
        else if (checksum % 10 == 0 && num / x == 4)
        {
            printf("VISA\n");
        }
        else
        {
            printf("INVALID\n");
        }
    }
    else if (counter == 15)
    {
        if (checksum % 10 == 0 && (num / z == 34 || num / z == 37))
        {
            printf("AMEX\n");
        }
        else
        {
            printf("INVALID\n");
        }
    }
    else
    {
        printf("INVALID\n");
    }
}
