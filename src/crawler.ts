import axios from "axios";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { DataSource } from "typeorm";

import { Pool } from "./pool";
 
export class CrawlerProcess {

    urlAPI: string;
    urlWeb1: string;
    urlWeb2: string;
    dataSource: DataSource;

    constructor(dataSource) {
        this.urlAPI = "https://app.thala.fi/api/liquidity-pools";
        this.urlWeb1 = "https://liquidswap.com/#/pools";
        this.urlWeb2 = "https://liquidswap.com/#/stakes";
        this.dataSource = dataSource;
    }

    async run() {
        const [ arr1, arr2, arr3 ] = await Promise.all([
            this.crawlerAPI(),
            this.crawlerWebDom1(),
            this.crawlerWebDom2()
        ])

        const data = arr1.concat(arr2, arr3);
        await this.dataSource.getRepository(Pool).insert(data);
        return data;
    }

    async crawlerAPI() {
        console.log("Run crawlerAPI...")
        const pools: Pool[] = [];
        try {
            const { data } = await axios.get(this.urlAPI);
            
            data.data?.map( item => {
                if (item.tvl && item.tvl > 100000) {
                    const pool = new Pool();
                    pool.type = item.poolType!;
                    pool.tvl = item.tvl!;
                    pool.apr = item.apr!;
                    pools.push(pool);
                }
            })
        } catch (error) {
            console.log(error)
        }

        return pools;
    }

    async crawlerWebDom2() {
        console.log("Run crawlerWebDom2")
        const pools: Pool[] = [];
        try {
            const browser = await puppeteer.launch({
                headless: "new",
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox"
                ]
            });
            const page = await browser.newPage();
            await page.goto(this.urlWeb2, {
                timeout: 200000,
                waitUntil: ['networkidle0']
            });

            const content = await page.content();
            const $ = cheerio.load(content);
            $(".stakes-pool .stake-body").each((i, elementPool) => {
                const pool = new Pool();
                pool.type = $(".stakes-pool .pool-title h3").text();
                const apr = {
                    source: "",
                    apr: 0
                };

                $(elementPool).find(".details").each((j, e) => {
                    const label = $(e).find(".label").text();
                    const value = $(e).find(".value").text();
                    if(label && value) {
                        switch (label) {
                            case "NFT:":
                                apr.source = value;
                                break;
                            case "APR:":
                                apr.apr = Number(value.replaceAll("%",""))
                                break;
                            case "TVL:":
                                pool.tvl = Number(value.replaceAll("$","").replaceAll(",",""));
                                break;
                        }
                    }
                });
                pool.apr = apr;

                if(pool.tvl > 100000) {
                    pools.push(pool);
                }
            });
        } catch (error) {
            console.log(error);
        }

        return pools;
    }

    async crawlerWebDom1() {
        console.log("Run crawlerWebDom1")
        const pools: Pool[] = [];
        try {
            const browser = await puppeteer.launch({
                headless: "new",
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox"
                ]
            });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await page.goto(this.urlWeb1, {
                timeout: 200000,
                waitUntil: ['networkidle0']
            });
            await page.click(".p-checkbox-box");
            await page.click("button.accept_button");
            await page.waitForTimeout(1000);
            await page.click(".p-datatable-footer");

            const content = await page.content();

            const $ = cheerio.load(content);
            $(".pools-container.mb-6 .p-datatable-tbody tr.p-selectable-row").each((i, elementPool) => {
                const pool = new Pool();
                const apr = {
                    source: "",
                    apr: 0
                };

                $(elementPool).find("td").each((j, e) => {
                    switch (j) {
                        case 0:
                            let source = ""
                            $(e).find(".pool .token-name-wrapper").each((k, name) => {
                                source = k === 0 ? $(name).find(".token-name-wrapper__alias").text() : source + "/" + $(name).find(".token-name-wrapper__alias").text()
                            });
                            apr.source = source;
                            pool.type = source;
                            break;
                        case 2:
                            const aprResult = $(e).find(".apr-column").text();
                            apr.apr = aprResult ? Number(aprResult.replaceAll("%","")): 0;
                            break;
                        case 3:
                            let tvl = $(e).find(".apr-column").text();
                            pool.tvl = 0;
                            if(tvl) {
                                tvl = tvl.replaceAll("$","").replaceAll(",","");
                                if(tvl.substr(tvl.length - 1) === "M"){
                                    tvl = tvl.replaceAll("M","");
                                    pool.tvl = Number(tvl)*1000000;
                                }else {
                                    pool.tvl = Number(tvl);
                                }
                            }
                            break;
                    }
                });
                pool.apr = apr;
                if(pool.tvl > 100000) {
                    pools.push(pool);
                }
            });
        } catch (error) {
            console.log(error);
        }

        return pools;
    }
}