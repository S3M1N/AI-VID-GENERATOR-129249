import express from "express";
import uniqid from "uniqid";
import fs from "fs";
import cors from "cors";
import { GPTScript, RunEventType } from "@gptscript-ai/gptscript";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.use(express.static("stories"));

ffmpeg.setFfmpegPath(ffmpegPath);
const g = new GPTScript({
  DefaultModel: "gpt-4o",
});

app.get("/test", (req, res) => {
  return res.json("test ok");
});

app.get("/create-story", async (req, res) => {
  const url = decodeURIComponent(req.query.url);
  const dir = uniqid();
  const fullPath = "./stories/" + dir; // Updated this variable name to avoid conflict with 'path' module

  fs.mkdirSync(fullPath, { recursive: true });
  console.log({ url });
  const opts = {
    input: `--url ${url} --dir ${fullPath}`,
    disableCache: true,
  };

  try {
    const run = await g.run("./story.gpt", opts);
    run.on(RunEventType.Event, (ev) => {
      if (ev.type === RunEventType.CallFinish && ev.output) {
        console.log(ev.output);
      }
    });

    const result = await run.text();
    return res.json(dir);
  } catch (e) {
    console.error(e);
    return res.json("error");
  }
});

app.get("/build-video", async (req, res) => {
  const id = req.query.id;
  if (!id) {
    return res.json("error. missing id");
  }
  const dir = "./stories/" + id;
  if (!fs.existsSync(dir)) {
    return res.status(404).json("error. directory not found");
  }

  if (!fs.existsSync(dir + "/1.png")) {
    fs.renameSync(dir + "/b-roll-1.png", dir + "/1.png");
    fs.renameSync(dir + "/b-roll-2.png", dir + "/2.png");
    fs.renameSync(dir + "/b-roll-3.png", dir + "/3.png");
    fs.renameSync(dir + "/voiceover-1.mp3", dir + "/1.mp3");
    fs.renameSync(dir + "/voiceover-2.mp3", dir + "/2.mp3");
    fs.renameSync(dir + "/voiceover-3.mp3", dir + "/3.mp3");
    fs.renameSync(dir + "/voiceover-1.txt", dir + "/transcription-1.json");
    fs.renameSync(dir + "/voiceover-2.txt", dir + "/transcription-2.json");
    fs.renameSync(dir + "/voiceover-3.txt", dir + "/transcription-3.json");
  }

  const images = ["1.png", "2.png", "3.png"];
  const audio = ["1.mp3", "2.mp3", "3.mp3"];
  const transcriptions = [
    "transcription-1.json",
    "transcription-2.json",
    "transcription-3.json",
  ];

  for (let i = 0; i < images.length; i++) {
    const inputImage = path.join(dir, images[i]);
    const inputAudio = path.join(dir, audio[i]);
    const inputTranscription = path.join(dir, transcriptions[i]);
    const outputVideo = path.join(dir, `output_${i}.mp4`);

    const transcription = JSON.parse(
      fs.readFileSync(inputTranscription, "utf8")
    );
    const words = transcription.words;
    const duration = parseFloat(transcription.duration).toFixed(2);

    const filters = words.map((wordInfo, index) => {
      const word = wordInfo.word.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const start = parseFloat(wordInfo.start).toFixed(2);
      const end = parseFloat(wordInfo.end).toFixed(2);

      return {
        filter: "drawtext",
        options: {
          text: word,
          fontcolor: "white",
          fontsize: 96,
          borderw: 4,
          bordercolor: "black",
          x: "(w-text_w)/2",
          y: "(h*3/4)-text_h",
          enable: `between(t\\,${start}\\,${end})`,
        },
      };
    });

    console.log(
      `Processing: ${inputImage} and ${inputAudio} with duration ${duration}`
    );

    await new Promise((resolve, reject) => {
      const command = ffmpeg()
        .input(inputImage)
        .loop(duration)
        .input(inputAudio)
        .audioCodec("copy")
        .outputOptions("-t", duration)
        .on("stderr", console.log)
        .on("error", (e) => {
          console.error(`FFmpeg error: ${e.message}`);
          reject(e);
        })
        .on("end", () => {
          console.log(`${outputVideo} creation complete.`);
          resolve();
        });

      filters.forEach((filter) => {
        command.videoFilter(filter);
      });

      command.save(outputVideo);
    });
  }

  console.log("Merging 3 videos together");
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(dir, "output_0.mp4"))
      .input(path.join(dir, "output_1.mp4"))
      .input(path.join(dir, "output_2.mp4"))
      .on("end", resolve)
      .on("error", reject)
      .mergeToFile(path.join(dir, "final.mp4"));
  });

  console.log("done");

  return res.json(`${id}/final.mp4`);
});

app.listen(8080, () => console.log("Listening on port 8080"));
