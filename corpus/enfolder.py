#!/usr/bin/env python

from argparse import ArgumentParser
from os import listdir, mkdir
from os.path import join, splitext
from random import sample
from shutil import move


def main():
    parser = ArgumentParser(description='Move each given file to a new folder of the same name, minus extension.')
    parser.add_argument('file', nargs='+', help='A file to move')
    args = parser.parse_args()

    for file in args.file:
        base, ext = splitext(file)
        mkdir(base)
        move(file, join(base, 'archive.webarchive'))


if __name__ == '__main__':
    main()
