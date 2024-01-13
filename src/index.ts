import { program } from "commander";
import { Config, Worker } from "@aptos-labs/aptos-processor-sdk";
import { EventProcessor } from "./processor";
import { CrawlerProcess } from "./crawler";
import { Event } from "./models";
import { DataSource } from "typeorm";
import { Pool } from "./pool";

type Args = {
  config: string;
  perf: number;
};

program
  .command("process")
  .requiredOption("--config <config>", "Path to a yaml config file")
  .action(async (args: Args) => {
    await main(args);
  });

program
  .command("crawler")
  .action(async () => {
    await mainCrawler();
  });

async function main({ config: configPath }: Args) {
  const config = Config.from_yaml_file(configPath);
  const processor = new EventProcessor();
  const worker = new Worker({
    config,
    processor,
    models: [Event],
  });
  await worker.run();
}

async function mainCrawler() {

  const dataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "postgres",
    password: "12345678",
    database: "example_event",
    entities: [Pool],
    synchronize: true,
    logging: true,
  });

  await dataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!")
    })
    .catch((err) => {
        console.error("Error during Data Source initialization", err)
    });

  const crawler = new CrawlerProcess(dataSource);
  await crawler.run();
  console.log("Crawler done!");
  return
}

program.parse();
