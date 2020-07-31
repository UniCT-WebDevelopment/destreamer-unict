import { Metadata, Session } from './Types';
import { forEachAsync } from './Utils';

import { parse } from 'iso8601-duration';
import axios from 'axios';

function publishedDateToString(date: string) {
    const dateJs = new Date(date);
    const day = dateJs.getDate().toString().padStart(2, '0');
    const month = (dateJs.getMonth() + 1).toString(10).padStart(2, '0');

    return day+'-'+month+'-'+dateJs.getFullYear();
}

function durationToTotalChunks(duration: string) {
    const durationObj = parse(duration);
    const hrs = durationObj['hours'] ?? 0;
    const mins = durationObj['minutes'] ?? 0;
    const secs = Math.ceil(durationObj['seconds'] ?? 0);

    return (hrs * 60) + mins + (secs / 60);
}


export async function getVideoMetadata(videoGuids: string[], session: Session, verbose: boolean): Promise<Metadata[]> {
    let metadata: Metadata[] = [];
    let title: string;
    let date: string;
    let totalChunks: number;
    let playbackUrl: string;
    let posterImage: string;

    await forEachAsync(videoGuids, async (guid: string) => {
        let apiUrl = `${session.ApiGatewayUri}videos/${guid}?api-version=${session.ApiGatewayVersion}`;

        if (verbose)
            console.info(`Calling ${apiUrl}`);

        let response = await axios.get(apiUrl,
            {
                headers: {
                    Authorization: `Bearer ${session.AccessToken}`
                }
            });

        title = response.data['name'];
        playbackUrl = response.data['playbackUrls']
            .filter((item: { [x: string]: string; }) =>
                item['mimeType'] == 'application/vnd.apple.mpegurl')
            .map((item: { [x: string]: string }) => { return item['playbackUrl']; })[0];

        posterImage = response.data['posterImage']['medium']['url'];
        date = publishedDateToString(response.data['publishedDate']);
        totalChunks = durationToTotalChunks(response.data.media['duration']);

        metadata.push({
            date: date,
            totalChunks: totalChunks,
            title: title,
            playbackUrl: playbackUrl,
            posterImage: posterImage
        });
    });

    return metadata;
}
