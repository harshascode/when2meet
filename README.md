Working on your own and just want it to work? Follow these instructions below, they’ve worked reliably for me and many others for years.

Working with others? Git is complicated. Read the comments below this answer, consider other answers, and discuss with your team before you do something rash.

Reverting Working Copy to Most Recent Commit
To revert to the previous commit, ignoring any changes:

git reset --hard HEAD
where HEAD is the last commit in your current branch

Reverting The Working Copy to an Older Commit
To revert to a commit that's older than the most recent commit:

# Resets index to former commit; replace '56e05fced' with your commit code

git reset 56e05fced

# Moves pointer back to previous HEAD

git reset --soft HEAD@{1}

git commit -m "Revert to 56e05fced"

# Updates working copy to reflect the new commit

git reset --hard

# Push your changes to respective branch

git push -f
Credits go to a similar Stack Overflow question, Revert to a commit by a SHA hash in Git?.

https://stackoverflow.com/questions/4114095/how-do-i-revert-a-git-repository-to-a-previous-commit
