#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[])
{
    if (argc != 2)
    {
        printf("Usage: ./recover FILE\n");
        return 1;
    }
    FILE *card = fopen(argv[1], "r");
    uint8_t buffer[512];
    char filename[8];
    int x = 1, y = 0;
    FILE *img = NULL;
    while (fread(buffer, 1, 512, card) == 512)
    {
        if(buffer[0] == 0xff && buffer[1] == 0xd8 && buffer[2] == 0xff && (buffer[3] & 0xf0) == 0xe0)
        {
            x = 0;
        }
        if(x == 0)
        {
            if(y != 0)
            {
                fclose(img);
            }
            sprintf(filename, "%03i.jpg", y);
            img = fopen(filename, "w");
            fwrite(buffer, 1, 512, img);
            y++;
            x = 1;

        }
        else if(y != 0)
        {
            fwrite(buffer, 1, 512, img);
        }
    }
    fclose(img);
    fclose(card);
}
