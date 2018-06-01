# zm2drive

A tool for archiving ZoneMinder events to Google Drive, written in Node.JS.

ZM events are zipped before uploading. Events that have already been uploaded
are skipped.

## Usage

```
usage: app.js [-h] --eventsDir DIR --clientSecret JSON_FILE [--tokenDir DIR]
              [--fromDate DATE] [--toDate DATE] [--targetDir REMOTE_DIR]
```

Run `zm2drive --help` more info.

## Requirements

### zip command-line tool

For reasons outlined below, you will need to have the `zip` command-line tool
installed on your system.

## Creating the Google Drive credentials

Follow Step 1 of the 
[Google Drive Quickstart Guide](https://developers.google.com/drive/api/v3/quickstart/nodejs).

## Examples

Upload all events between the 12th and 13th of March, 2018, from `./zm_events`,
to a folder on Google Drive called `ZmEvents`.

```
$ zm2drive --eventsDir ./zm_events \
    --clientSecret client_secret.json \
    --tokenDir ./token \
    --targetDir ZmEvents \
    --fromDate 2018-03-12 \
    --toDate 2018-03-13
```

## Notes

### Use of zip command-line tool instead of archiver

In order to ensure that zip files give the same checksums when their contents
are the same, we need to strip metadata. The `zip` command provides a `-X`/
`--no-extra` option for this. Unfortunately, the `archiver` library does not
support this option. So for the time being we have to defer to the command-line
zip tool.
