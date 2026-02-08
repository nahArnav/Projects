#include <cs50.h>
#include <ctype.h>
#include <stdio.h>
#include <string.h>
int calc(string s);
int main(void)
{
    string p1 = get_string("Player 1:");
    string p2 = get_string("Player 2:");
    int s1 = calc(p1);
    int s2 = calc(p2);
    if(s1 > s2)
    {
        printf("Player 1 wins!\n");
    }
    else if(s1 < s2)
    {
        printf("Player 2 wins!\n");
    }
    else
    {
        printf("Tie!\n");
    }
}
int calc(string p)
{
    int score = 0;
    int x = strlen(p);
    char d = '1';
    for(int i = 0; i < x; i++)
    {
        d = toupper(p[i]);
        if(d == 'A' || d == 'E' || d == 'I' || d == 'L' || d == 'N' || d == 'O' || d == 'R' || d == 'S' || d == 'T' || d == 'U')
        {
            score += 1;
        }
        else if(d == 'D' || d == 'G')
        {
            score += 2;
        }
        else if(d == 'B' || d == 'C' || d == 'M' || d == 'P')
        {
            score += 3;
        }
        else if(d == 'F' || d == 'H' || d == 'V' || d == 'W' || d == 'Y')
        {
            score += 4;
        }
        else if(d == 'K')
        {
            score += 5;
        }
        else if(d == 'J' || d == 'X')
        {
            score += 8;
        }
        else if(d == 'Q' || d == 'Z')
        {
            score += 10;
        }
    }
    return score;
}
