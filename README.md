# Destreamer - UNICT

## Saves Microsoft Stream videos for offline enjoyment

### This is a fork of [snobu/destreamer](https://github.com/snobu/destreamer)


## DISCLAIMER

Hopefully this doesn't break the end user agreement for Microsoft Stream. Since we're simply saving the HLS stream to disk as if we were a browser, this does not abuse the streaming endpoints. However i take no responsibility if either Microsoft or your Office 365 admins request a chat with you in a small white room.

## PREREQS

* **ffmpeg**: a recent version (year 2019 or above)
* **nodejs**: a recent version
* **git**

# WARNING: IMPORTANT!
**A BROWSER PAGE WILL POPUP FORM TIME TO TIME TO REFRESH THE ACCESS TOKEN**

**DO NOT CLOSE THE NEWLY OPENED BROWSER!**

**DO NOT RELOAD THE PAGE!**

## USAGE

* Unpack destreamer and chromium into the same folder
* Open a terminal in this new directory
* Run destreamer executable

Linux / MacOS
```
$ ./destreamer
```

Windows
```
destreamer.exe
```

## Options
```
Options:
  --help                    Show Help

  --version                 Show version number

  --videoUrls, -i           List of video urls

  --videoUrlsFile, -f       Path to txt file containing the urls

  --udataPath, -l           Path to a txt file containing your login data (See README)

  --noLoginSave, --nlog     Skip "keep me signed in" page                           [default: false]

  --outputDirectory, -o     The directory where destreamer will save your downloads [default: videos]

  --outputDirectories, -O   Path to a txt file containing one output directory per video

  --hideBrowser, -h         Hide Chromium browser activity                          [default: false]

  --noThumbnails, --nthumb  Do not display video thumbnails                         [default: true]

  --simulate, -s            Disable video download and print metadata
                            information to the console                              [default: false]

  --verbose, -v             Print additional information to the console
                            (use this before opening an issue on GitHub)            [default: false]

```

## Auto-login
Create a txt file as follow:

```
YourUnictEmail
YourUnictUsername
YourUnictPassword
```

Example:
```
unig2@unict.it
UNIG29F90S
00003900
```

Run destreamer:
```
$ ./destreamer -f links.txt -l logind.txt
```

If you get stuck in "keep me signed in" page:
```
$ ./destreamer -f links.txt -l logind.txt --nlog
```

Make sure you use the right escape char for your shell if using line breaks (as this example shows).

For PowerShell your escape char is the backtick (`) instead of backslash (\\), for cmd.exe use caret (^).

## URLs from file
Create a new txt file with URLs like this:
```
Content of list.txt:

URL1
URL2
URL3
...
```

Run destreamer
```
$ ./destreamer -f list.txt
```

To define one output directory per video, create a new txt file:
```
Content of out.txt:

MyOutDirForURL1
MyOutDirForURL2
MyOutDirForURL3
...
```

Run destreamer:
```
$ ./destreamer -f list.txt -O out.txt
```

**If you use this option, you must specify an output directory for each URL.**

## HOW TO BUILD

## PREREQS
* **Node.js**: a recent release.

## HOW TO BUILD FOR RELEASE
Destreamer builder supports the following environments:
* Linux
* WSL (Windows Linux Subsystem)
* MacOS
* Windows

Requirements
* [pkg](https://www.npmjs.com/package/pkg)
* wget
* git

`Install pkg to your system with the command:`
```
npm i -g pkg
```

You will find your release package in destreamer root directory.

To build a release package, run the following commands:
* `$ npm install`
* `$ cd scripts`

Linux / WSL / macOS users:

* `$ chmod +x make_release.sh`
* `$ ./make_release.sh`

Windows users:

* `make_release_win.bat`

```
Usage: make_realse [option]

 help  - Show usage
 linux - Build for Linux x64
 win   - Build for Windows x64
 macos - Build for MacOS x64
 all   - Build all

 default: all
```

## HOW TO BUILD FOR DEVELOPMENT
You can build destreamer on any OS.

You will find destreamer.js in `build/src` folder.

To build destreamer.js run the following commands:
* `npm install`
* `npm run -s build`
