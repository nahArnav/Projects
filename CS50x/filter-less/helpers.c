#include "helpers.h"
#include <math.h>

// Convert image to grayscale
void grayscale(int height, int width, RGBTRIPLE image[height][width])
{
    for(int i = 0; i < height; i++)
    {
        for(int j = 0; j < height; j++)
        {
            float avg1 = (image[i][j].rgbtRed + image[i][j].rgbtBlue + image[i][j].rgbtGreen)/3.0;
            int avg = (int)round(avg1);
            image[i][j].rgbtRed = avg;
            image[i][j].rgbtBlue = avg;
            image[i][j].rgbtGreen = avg;
        }
    }
    return;
}

// Convert image to sepia
void sepia(int height, int width, RGBTRIPLE image[height][width])
{
    for (int i = 0; i < height; i++)
    {
        for (int j = 0; j < width; j++)
        {
            int orgRed, orgBlue, orgGreen;
            orgRed = image[i][j].rgbtRed;
            orgBlue = image[i][j].rgbtBlue;
            orgGreen = image[i][j].rgbtGreen;
            float sepRed, sepBlue, sepGreen;
            sepRed = (0.393 * orgRed) + (0.769 * orgGreen) + (0.189 * orgBlue);
            sepGreen = (0.349 * orgRed) + (0.686 * orgGreen) + (0.168 * orgBlue);
            sepBlue = (0.272 * orgRed) + (0.534 * orgGreen) + (0.131 * orgBlue);
            int sepRedf, sepBluef, sepGreenf;
            sepRedf = (int) round(sepRed);
            sepGreenf = (int) round(sepGreen);
            sepBluef = (int) round(sepBlue);
            if(sepRedf > 255)
            {
                sepRedf = 255;
            }
            if(sepBluef > 255)
            {
                sepBluef = 255;
            }
            if(sepGreenf > 255)
            {
                sepGreenf = 255;
            }
            image[i][j].rgbtRed = sepRedf;
            image[i][j].rgbtBlue = sepBluef;
            image[i][j].rgbtGreen = sepGreenf;
        }
    }
    return;
}

// Reflect image horizontally
void reflect(int height, int width, RGBTRIPLE image[height][width])
{
    for (int i = 0; i < height; i++)
    {
        int x = (int)round(width/2);
        for (int j = 0; j < x; j++)
        {
            int tempr, tempb, tempg;
            tempr = image[i][j].rgbtRed;
            tempb = image[i][j].rgbtBlue;
            tempg = image[i][j].rgbtGreen;
            image[i][j].rgbtRed = image[i][width - 1 - j].rgbtRed;
            image[i][j].rgbtBlue = image[i][width - 1 - j].rgbtBlue;
            image[i][j].rgbtGreen = image[i][width - 1 - j].rgbtGreen;
            image[i][width - 1 - j].rgbtRed = tempr;
            image[i][width - 1 - j].rgbtBlue = tempb;
            image[i][width - 1 - j].rgbtGreen = tempg;
        }
    }
    return;
}

// Blur image
void blur(int height, int width, RGBTRIPLE image[height][width])
{
    RGBTRIPLE copy[height][width];
    for (int i = 0; i < height; i++)
    {
        for (int j = 0; j < width; j++)
        {
            copy[i][j] = image[i][j];
        }
    }
    for (int i = 0; i < height; i++)
    {
        for (int j = 0; j < width; j++)
        {
            float avgr = 0, avgb = 0, avgg = 0;
            if(i == 0 && j == 0)
            {
                avgr = (copy[i][j].rgbtRed + copy[i + 1][j].rgbtRed + copy[i][j + 1].rgbtRed + copy[i + 1][j + 1].rgbtRed)/4.0;
                avgb = (copy[i][j].rgbtBlue + copy[i + 1][j].rgbtBlue + copy[i][j + 1].rgbtBlue + copy[i + 1][j + 1].rgbtBlue)/4.0;
                avgg = (copy[i][j].rgbtGreen + copy[i + 1][j].rgbtGreen + copy[i][j + 1].rgbtGreen + copy[i + 1][j + 1].rgbtGreen)/4.0;
            }
            else if(i == 0 && (j != 0 && j != (width - 1)))
            {
                avgr = (copy[i][j - 1].rgbtRed + copy[i + 1][j - 1].rgbtRed + copy[i][j].rgbtRed + copy[i + 1][j].rgbtRed + copy[i][j + 1].rgbtRed + copy[i + 1][j + 1].rgbtRed)/6.0;
                avgb = (copy[i][j - 1].rgbtBlue + copy[i + 1][j - 1].rgbtBlue + copy[i][j].rgbtBlue + copy[i + 1][j].rgbtBlue + copy[i][j + 1].rgbtBlue + copy[i + 1][j + 1].rgbtBlue)/6.0;
                avgg = (copy[i][j - 1].rgbtGreen + copy[i + 1][j - 1].rgbtGreen + copy[i][j].rgbtGreen + copy[i + 1][j].rgbtGreen + copy[i][j + 1].rgbtGreen + copy[i + 1][j + 1].rgbtGreen)/6.0;
            }
            else if(i == 0 && j == (width - 1))
            {
                avgr = (copy[i][j - 1].rgbtRed + copy[i + 1][j - 1].rgbtRed + copy[i][j].rgbtRed + copy[i + 1][j].rgbtRed)/4.0;
                avgb = (copy[i][j - 1].rgbtBlue + copy[i + 1][j - 1].rgbtBlue + copy[i][j].rgbtBlue + copy[i + 1][j].rgbtBlue)/4.0;
                avgg = (copy[i][j - 1].rgbtGreen + copy[i + 1][j - 1].rgbtGreen + copy[i][j].rgbtGreen + copy[i + 1][j].rgbtGreen)/4.0;
            }
            else if((i != 0 && i != (height - 1)) && j == 0)
            {
                avgr = (copy[i - 1][j].rgbtRed + copy[i - 1][j + 1].rgbtRed + copy[i][j].rgbtRed + copy[i + 1][j].rgbtRed + copy[i][j + 1].rgbtRed + copy[i + 1][j + 1].rgbtRed)/6.0;
                avgb = (copy[i - 1][j].rgbtBlue + copy[i - 1][j + 1].rgbtBlue + copy[i][j].rgbtBlue + copy[i + 1][j].rgbtBlue + copy[i][j + 1].rgbtBlue + copy[i + 1][j + 1].rgbtBlue)/6.0;
                avgg = (copy[i - 1][j].rgbtGreen + copy[i - 1][j + 1].rgbtGreen + copy[i][j].rgbtGreen + copy[i + 1][j].rgbtGreen + copy[i][j + 1].rgbtGreen + copy[i + 1][j + 1].rgbtGreen)/6.0;
            }
            else if(i == (height - 1) && j == 0)
            {
                avgr = (copy[i - 1][j].rgbtRed + copy[i - 1][j + 1].rgbtRed + copy[i][j].rgbtRed  + copy[i][j + 1].rgbtRed)/4.0;
                avgb = (copy[i - 1][j].rgbtBlue + copy[i - 1][j + 1].rgbtBlue + copy[i][j].rgbtBlue + copy[i][j + 1].rgbtBlue)/4.0;
                avgg = (copy[i - 1][j].rgbtGreen + copy[i - 1][j + 1].rgbtGreen + copy[i][j].rgbtGreen + copy[i][j + 1].rgbtGreen)/4.0;
            }
            else if(i == (height - 1) && (j != 0 && j != (width - 1)))
            {
                avgr = (copy[i - 1][j - 1].rgbtRed + copy[i][j - 1].rgbtRed + copy[i - 1][j].rgbtRed + copy[i - 1][j + 1].rgbtRed + copy[i][j].rgbtRed  + copy[i][j + 1].rgbtRed)/6.0;
                avgb = (copy[i - 1][j - 1].rgbtBlue + copy[i][j - 1].rgbtBlue + copy[i - 1][j].rgbtBlue + copy[i - 1][j + 1].rgbtBlue + copy[i][j].rgbtBlue + copy[i][j + 1].rgbtBlue)/6.0;
                avgg = (copy[i - 1][j - 1].rgbtGreen + copy[i][j - 1].rgbtGreen + copy[i - 1][j].rgbtGreen + copy[i - 1][j + 1].rgbtGreen + copy[i][j].rgbtGreen + copy[i][j + 1].rgbtGreen)/6.0;
            }
            else if(i == (height - 1) && j == (width - 1))
            {
                avgr = (copy[i - 1][j - 1].rgbtRed + copy[i][j - 1].rgbtRed + copy[i - 1][j].rgbtRed + copy[i][j].rgbtRed)/4.0;
                avgb = (copy[i - 1][j - 1].rgbtBlue + copy[i][j - 1].rgbtBlue + copy[i - 1][j].rgbtBlue + copy[i][j].rgbtBlue)/4.0;
                avgg = (copy[i - 1][j - 1].rgbtGreen + copy[i][j - 1].rgbtGreen + copy[i - 1][j].rgbtGreen + copy[i][j].rgbtGreen)/4.0;
            }
            else if((i != 0 && i != (height - 1)) && j == (width - 1))
            {
                avgr = (copy[i - 1][j - 1].rgbtRed + copy[i][j - 1].rgbtRed + copy[i - 1][j].rgbtRed + copy[i][j].rgbtRed + copy[i + 1][j - 1].rgbtRed + copy[i + 1][j].rgbtRed)/6.0;
                avgb = (copy[i - 1][j - 1].rgbtBlue + copy[i][j - 1].rgbtBlue + copy[i - 1][j].rgbtBlue + copy[i][j].rgbtBlue+ copy[i + 1][j - 1].rgbtBlue + copy[i + 1][j].rgbtBlue)/6.0;
                avgg = (copy[i - 1][j - 1].rgbtGreen + copy[i][j - 1].rgbtGreen + copy[i - 1][j].rgbtGreen + copy[i][j].rgbtGreen+ copy[i + 1][j - 1].rgbtGreen + copy[i + 1][j].rgbtGreen)/6.0;
            }
            else
            {
                avgr = (copy[i - 1][j - 1].rgbtRed + copy[i - 1][j].rgbtRed + copy[i - 1][j + 1].rgbtRed + copy[i][j - 1].rgbtRed + copy[i][j].rgbtRed + copy[i][j + 1].rgbtRed + copy[i + 1][j - 1].rgbtRed + copy[i + 1][j].rgbtRed + copy[i + 1][j + 1].rgbtRed)/9.0;
                avgb = (copy[i - 1][j - 1].rgbtBlue + copy[i - 1][j].rgbtBlue + copy[i - 1][j + 1].rgbtBlue + copy[i][j - 1].rgbtBlue + copy[i][j].rgbtBlue + copy[i][j + 1].rgbtBlue + copy[i + 1][j - 1].rgbtBlue + copy[i + 1][j].rgbtBlue + copy[i + 1][j + 1].rgbtBlue)/9.0;
                avgg = (copy[i - 1][j - 1].rgbtGreen + copy[i - 1][j].rgbtGreen + copy[i - 1][j + 1].rgbtGreen + copy[i][j - 1].rgbtGreen + copy[i][j].rgbtGreen + copy[i][j + 1].rgbtGreen + copy[i + 1][j - 1].rgbtGreen + copy[i + 1][j].rgbtGreen + copy[i + 1][j + 1].rgbtGreen)/9.0;
            }
            avgr = round(avgr);
            avgb = round(avgb);
            avgg = round(avgg);
            image[i][j].rgbtRed = (int) avgr;
            image[i][j].rgbtBlue = (int) avgb;
            image[i][j].rgbtGreen = (int) avgg;
        }
    }
    return;
}
