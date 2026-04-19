# This script is very much for my (orez-'s) own personal use:
# it builds the app and then copies it into the repo for my public page,
# in a project sibling to this one. It makes a lot of assumptions, is
# my point!
set -euxo pipefail
shopt -s dotglob
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd "${SCRIPT_DIR}/.."

XWORD_BASE_PATH="/crosswords/play" npm run build
PAGE_PATH=../orez-share.github.io/peapods/gh-pages/crosswords/play/
rm -rf "$PAGE_PATH"
mkdir "$PAGE_PATH"
cp -r build/* "$PAGE_PATH"
