import { UrlReplacer } from "./parser";

export const MainReplacer: UrlReplacer = async (urls: string[]): Promise<string[]> => {
    let res: string[] = [];
    console.log("SampleParser called with URLs:", urls);
    urls.forEach(url => {
        res.push("BEGIN: " + url + " :END");
    });
    return res;
}