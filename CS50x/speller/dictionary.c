// Implements a dictionary's functionality

#include <ctype.h>
#include<stdio.h>
#include <stdbool.h>
#include <string.h>
#include <strings.h>
#include <stdlib.h>

#include "dictionary.h"

// Represents a node in a hash table
typedef struct node
{
    char word[LENGTH + 1];
    struct node *next;
} node;

// TODO: Choose number of buckets in hash table
const unsigned int N = 26;
int dicnt = 0;
// Hash table
node *table[N];

// Returns true if word is in dictionary, else false
bool check(const char *word)
{
    // TODO
    int y = hash(word);
    node *cursor = table[y];
    while(cursor != NULL)
    {
        if(strcasecmp(word, cursor->word) == 0)
        {
            return true;
        }
        else
        {
            cursor = cursor->next;
        }
    }
    return false;
}

// Hashes word to a number
unsigned int hash(const char *word)
{
    // TODO: Improve this hash function
    return toupper(word[0]) - 'A';
}

// Loads dictionary into memory, returning true if successful, else false
bool load(const char *dictionary)
{
    // TODO
    FILE *source = fopen(dictionary, "r");
    if(source == NULL)
    {
        return false;
    }
    for(int i = 0; i < N; i++)
    {
        table[i] = NULL;
    }

    char buff[LENGTH];
    while(fscanf(source, "%s", buff) != EOF)
    {
        node *nw = malloc(sizeof(node));
        strcpy(nw->word, buff);
        int x = hash(nw->word);

        nw->next = table[x];
        table[x] = nw;
        dicnt++;

    }
    fclose(source);
    return true;
}

// Returns number of words in dictionary if loaded, else 0 if not yet loaded
unsigned int size(void)
{
    // TODO
    return dicnt;
}

// Unloads dictionary from memory, returning true if successful, else false
bool unload(void)
{
    // TODO
    for(int i = 0; i < N; i++)
    {
        node *cursor = table[i];
        node *temp = table[i];
        while(cursor != NULL)
        {
            cursor = cursor->next;
            free(temp);
            temp = cursor;
        }

    }
    return true;
}
