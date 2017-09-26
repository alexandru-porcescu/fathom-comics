#!/usr/bin/env python
# How the corpus was built:
# 1. Start with the Belfry WebComics Index: http://new.belfrycomics.net/view/all. (Choose "All Comics" and "Daily" as filters.) Spider down all those linked pages.
# 2. Throw out the few (about 5) pages that are clearly not single comics. Doing this early makes it likely our training and test sets will still be close to 70/30.
# 3. Use this to divide into a training set (for optimizing weights and getting best-case performance) and a testing set (for seeing how we did on unseen data). We use a 70/30 split only because it is a common rule of thumb. We forgo a validation set because we either (depending on how you look at it) have no hyperparameters (e.g. shapes of neural networks) to tune or have so many competing algorithms (one per unique set of rules as the ruleset evolves) that comparing them all would be infeasible.

from os import listdir
from os.path import join
from random import shuffle
from shutil import move


comics = [c for c in listdir('all') if not c.startswith('.')]
shuffle(comics)
divider = int(len(comics) * .7)
for comic in comics[:divider]:
    move(join('all', comic), 'training')
for comic in comics[divider:]:
    move(join('all', comic), 'testing')
