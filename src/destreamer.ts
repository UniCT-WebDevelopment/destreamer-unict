import {
    sleep, parseVideoUrls, checkRequirements, makeUniqueTitle, ffmpegTimemarkToChunk,
    makeOutputDirectories, getOutputDirectoriesList, checkOutDirsUrlsMismatch
} from './Utils';
import { getPuppeteerChromiumPath } from './PuppeteerHelper';
import { setProcessEvents } from './Events';
import { ERROR_CODE } from './Errors';
import { TokenCache } from './TokenCache';
import { getVideoMetadata } from './Metadata';
import { Metadata, Session } from './Types';
import { drawThumbnail } from './Thumbnail';
import { argv } from './CommandLineParser';

import isElevated from 'is-elevated';
import puppeteer from 'puppeteer';
import colors from 'colors';
import fs from 'fs';
import path from 'path';
import sanitize from 'sanitize-filename';
import cliProgress from 'cli-progress';

const { FFmpegCommand, FFmpegInput, FFmpegOutput } = require('@tedconf/fessonia')();
const tokenCache = new TokenCache();


async function init() {
    setProcessEvents(); // must be first!

    if (await isElevated())
        process.exit(ERROR_CODE.ELEVATED_SHELL);

    checkRequirements();

    if (argv.username)
        console.info('Username: %s', argv.username);

    if (argv.simulate)
        console.info(colors.yellow('Simulate mode, there will be no video download.\n'));

    if (argv.verbose) {
        console.info('Video URLs:');
        console.info(argv.videoUrls);
    }
}

async function DoInteractiveLogin(url: string, logData: string[], nLog: boolean): Promise<Session> {
    const videoId = url.split("/").pop() ?? process.exit(ERROR_CODE.INVALID_VIDEO_ID)

    console.log(colors.bgYellow(colors.black('Fetching new access token.')));
    console.log('Launching headless Chrome to perform the OpenID Connect dance...');

    const browser = await puppeteer.launch({
        executablePath: getPuppeteerChromiumPath(),
        headless: argv.hideBrowser,
        args: ['--disable-dev-shm-usage']
    });
    const page = (await browser.pages())[0];

    console.log('Navigating to login page...');

    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('input[type="email"]');

    if (logData.length) {
        await page.keyboard.type(logData[0]);
        await page.click('input[type="submit"]');

        // auto-login to unict
        await page.waitForNavigation({waitUntil: 'networkidle2'});
        await page.waitForSelector('input[type="text"]');
        await page.focus('input[type="text"]');
        await page.keyboard.type(logData[1]);
        await page.waitForSelector('input[type="password"]');
        await page.focus('input[type="password"]');
        await page.keyboard.type(logData[2]);
        await page.click('input[type="submit"]');

        if (nLog) {
            // fucking dialog
            await page.waitForNavigation({waitUntil: 'networkidle2' });
            await page.waitForSelector('input[id="idBtn_Back"]', { timeout: 1000 });
            await page.focus('input[id="idBtn_Back"]');
            await page.click('input[id="idBtn_Back"]');
        }
    }

    await browser.waitForTarget(target => target.url().includes(videoId), { timeout: 150000 });
    console.info('We are logged in.');

    let session = null;
    let tries: number = 1;

    while (!session) {
        try {
            let sessionInfo: any;
            session = await page.evaluate(
                () => {
                    return {
                        AccessToken: sessionInfo.AccessToken,
                        ApiGatewayUri: sessionInfo.ApiGatewayUri,
                        ApiGatewayVersion: sessionInfo.ApiGatewayVersion
                    };
                }
            );
        } catch (error) {
            if (tries > 5)
                process.exit(ERROR_CODE.NO_SESSION_INFO);

            session = null;
            tries++;
            await sleep(3000);
        }
    }

    tokenCache.Write(session);
    console.log('Wrote access token to token cache.');
    console.log("At this point Chromium's job is done, shutting it down...\n");

    await browser.close();

    return session;
}

function extractVideoGuid(videoUrls: string[]): string[] {
    const videoGuids: string[] = [];
    let guid: string | undefined = '';

    for (const url of videoUrls) {
        try {
            const urlObj = new URL(url);

            guid = urlObj.pathname.split('/').pop();

        } catch (e) {
            console.error(`${e.message}`);
            process.exit(ERROR_CODE.INVALID_VIDEO_GUID);
        }

        if (guid)
            videoGuids.push(guid);
    }

    if (argv.verbose) {
        console.info('Video GUIDs:');
        console.info(videoGuids);
    }

    return videoGuids;
}

async function downloadVideo(videoUrls: string[], outputDirectories: string[], logdata: string[]) {
    const videoGuids = extractVideoGuid(videoUrls);
    let session = tokenCache.Read() ?? await DoInteractiveLogin(videoUrls[0], logdata, argv.noLoginSave);

    console.log('Fetching metadata...');

    const metadata: Metadata[] = await getVideoMetadata(videoGuids, session, argv.verbose);

    if (argv.simulate) {
        metadata.forEach(video => {
            console.log(
                colors.yellow('\n\nTitle: ') + colors.green(video.title) +
                colors.yellow('\nPublished Date: ') + colors.green(video.date) +
                colors.yellow('\nPlayback URL: ') + colors.green(video.playbackUrl)
            );
        });

        return;
    }

    if (argv.verbose)
        console.log(outputDirectories);

    const outDirsIdxInc = outputDirectories.length > 1 ? 1:0;
    for (let i=0, j=0, l=metadata.length; i<l; ++i, j+=outDirsIdxInc) {
        const video = metadata[i];
        const pbar = new cliProgress.SingleBar({
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            format: 'progress [{bar}] {percentage}% {speed} {eta_formatted}',
            barsize: Math.floor((process.stdout.columns || 30) / 3),
            stopOnComplete: true,
            hideCursor: true,
        });

        session = tokenCache.Read() ?? await DoInteractiveLogin(videoUrls[0], logdata, argv.noLoginSave);

        console.log(colors.yellow(`\nDownloading Video: ${video.title}\n`));

        if (outputDirectories.length > 1)
            console.log(colors.yellow(`Output directory:\n${outputDirectories[j]}\n`));

        video.title = makeUniqueTitle(sanitize(video.title) + ' - ' + video.date, outputDirectories[j]);

        // Very experimental inline thumbnail rendering
        if (!argv.noThumbnails)
            await drawThumbnail(video.posterImage, session.AccessToken);

        console.info('Spawning ffmpeg with access token and HLS URL. This may take a few seconds...\n');

        const outputPath = outputDirectories[j] + path.sep + video.title + '.mkv';
        const ffmpegInpt = new FFmpegInput(video.playbackUrl, new Map([
            ['headers', `Authorization:\ Bearer\ ${session.AccessToken}`]
        ]));
        const ffmpegOutput = new FFmpegOutput(outputPath, new Map([
            ['c:a', 'copy'],
            ['c:v', 'copy']
        ]));
        const ffmpegCmd = new FFmpegCommand();
        const cleanupFn = function () {
            pbar.stop();

            if (argv.noCleanup)
                return;

            try {
                fs.unlinkSync(outputPath);
            } catch(e) {}
        }

        pbar.start(video.totalChunks, 0, {
            speed: '0'
        });

        // prepare ffmpeg command line
        ffmpegCmd.addInput(ffmpegInpt);
        ffmpegCmd.addOutput(ffmpegOutput);

        // set events
        ffmpegCmd.on('update', (data: any) => {
            const currentChunks = ffmpegTimemarkToChunk(data.out_time);

            pbar.update(currentChunks, {
                speed: data.bitrate
            });

            if (!process.stdout.columns)
                process.stdout.write(`--- Speed: ${data.bitrate}, Cursor: ${data.out_time}\r`);
        });

        ffmpegCmd.on('error', (error: any) => {
            cleanupFn();

            console.log(`\nffmpeg returned an error: ${error.message}`);
            process.exit(ERROR_CODE.UNK_FFMPEG_ERROR);
        });

        process.on('SIGINT', cleanupFn);

        // let the magic begin...
        await new Promise((resolve: any, reject: any) => {
            ffmpegCmd.on('success', (data:any) => {
                pbar.update(video.totalChunks); // set progress bar to 100%
                console.log(colors.green(`\nDownload finished: ${outputPath}`));
                resolve();
            });

            ffmpegCmd.spawn();
        });

        process.off('SIGINT', cleanupFn);
    }
}


function getLoginData() {
    let logdata: string[] = [];

    if (argv.udataPath) {
        if (!fs.existsSync(argv.udataPath))
            process.exit(ERROR_CODE.NO_LOGINDATA_FILE);

        logdata = fs.readFileSync(argv.udataPath).toString('utf-8').split(/[\r\n]/);
        if (logdata.length === 0)
            process.exit(ERROR_CODE.READ_LOGDATA_FAIL);

        const dataf: string[] = [];

        logdata.forEach(line => {
            if (line !== "")
            dataf.push(line);
        });

        logdata = dataf;
    }

    return logdata;
}

async function main() {
    await init(); // must be first

    const outDirs: string[] = getOutputDirectoriesList(argv.outputDirectory as string);
    const videoUrls: string[] = parseVideoUrls(argv.videoUrls);
    const logData: string[] = getLoginData();

    checkOutDirsUrlsMismatch(outDirs, videoUrls);
    makeOutputDirectories(outDirs); // create all dirs now to prevent ffmpeg panic

    downloadVideo(videoUrls, outDirs, logData);
}

// run
main();
