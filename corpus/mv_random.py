#!/usr/bin/env python
# How the corpus was built:
# 1. Start with the Belfry WebComics Index: http://new.belfrycomics.net/view/all. (Choose "All Comics" and "Daily" as filters.) Spider down all those linked pages.
# 2. Throw out the few (about 5) pages that are clearly not single comics. Doing this early makes it likely our training and test sets will still be close to 70/30.
# 3. Use this to divide into a training set (for optimizing weights and getting best-case performance) and a testing set (for seeing how we did on unseen data). We use a 70/30 split only because it is a common rule of thumb. Since I'm writing features by hand, I start with a small subset of the training set (30 comics) and validate on another small subset. If the validation goes poorly, we induct that validation set into the training set, look for patterns of error in it, and adjust the features to eliminate them. Then we validate against a new subset, and so on. Hopefully, we start to do okay before we run out of data. The test set is for final error estimation.

from argparse import ArgumentParser
from os import listdir
from os.path import join
from random import sample
from shutil import move


def main():
    parser = ArgumentParser(description='Move a given number of random things from one directory to another. Ignore hidden files.')
    parser.add_argument('from_dir', help='The directory to move files from')
    parser.add_argument('to_dir', help='The directory to move files to')
    parser.add_argument('number', type=int, help='How many files to move')

    args = parser.parse_args()
    files = [f for f in listdir(args.from_dir) if not f.startswith('.')]
    for file in sample(files, args.number):
        move(join(args.from_dir, file), args.to_dir)


if __name__ == '__main__':
    main()
