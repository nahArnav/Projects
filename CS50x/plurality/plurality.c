#include <cs50.h>
#include <stdio.h>
#include <string.h>

// Max number of candidates
#define MAX 9

// Candidates have name and vote count
typedef struct
{
    string name;
    int votes;
} candidate;

// Array of candidates
candidate candidates[MAX];

// Number of candidates
int candidate_count;

// Function prototypes
bool vote(string name);
void print_winner(void);

int main(int argc, string argv[])
{
    // Check for invalid usage
    if (argc < 2)
    {
        printf("Usage: plurality [candidate ...]\n");
        return 1;
    }

    // Populate array of candidates
    candidate_count = argc - 1;
    if (candidate_count > MAX)
    {
        printf("Maximum number of candidates is %i\n", MAX);
        return 2;
    }
    for (int i = 0; i < candidate_count; i++)
    {
        candidates[i].name = argv[i + 1];
        candidates[i].votes = 0;
    }

    int voter_count = get_int("Number of voters: ");

    // Loop over all voters
    for (int i = 0; i < voter_count; i++)
    {
        string name = get_string("Vote: ");

        // Check for invalid vote
        if (!vote(name))
        {
            printf("Invalid vote.\n");
        }
    }

    // Display winner of election
    print_winner();
}

// Update vote totals given a new vote
bool vote(string name)
{
    for (int n = 0; n < candidate_count; n++)
    {
        if (strcmp(candidates[n].name, name) == 0)
        {
            candidates[n].votes += 1;
            return true;
        }
    }
    return false;
}

// Print the winner (or winners) of the election
void print_winner(void)
{
    for (int y = 0; y < candidate_count; y++)
    {
        int swaps = 0;
        for (int z = 0; z < candidate_count - 1; z++)
        {
            if (candidates[z].votes < candidates[z + 1].votes)
            {
                int tempv = candidates[z].votes;
                string tempn = candidates[z].name;
                candidates[z].votes = candidates[z + 1].votes;
                candidates[z].name = candidates[z + 1].name;
                candidates[z + 1].votes = tempv;
                candidates[z + 1].name = tempn;
                swaps += 1;
            }
        }
        if (swaps == 0)
        {
            break;
        }
    }
    for (int j = 0; j < candidate_count; j++)
    {
        if (candidates[j].votes == candidates[0].votes)
        {
            printf("%s\n", candidates[j].name);
        }
    }
    return;
}
