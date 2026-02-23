import fs from "fs";
import path from "path";
import https from "https";
import sharp from "sharp";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        let isRedirect =
          res.statusCode >= 300 && res.statusCode < 400 && res.headers.location;
        if (isRedirect) {
          resolve(fetchJson(res.headers.location));
          return;
        }
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let isRedirect =
          res.statusCode >= 300 && res.statusCode < 400 && res.headers.location;
        if (isRedirect) {
          resolve(downloadImageBuffer(res.headers.location));
          return;
        }
        const data = [];
        res.on("data", (chunk) => data.push(chunk));
        res.on("end", () => resolve(Buffer.concat(data)));
      })
      .on("error", reject);
  });
}

const map = {
  ex_pullups: "Pullups",
  ex_bench_press: "Barbell Bench Press - Medium Grip",
  ex_overhead_press: "Barbell Shoulder Press",
  ex_incline_db_press: "Incline Dumbbell Press",
  ex_back_squat: "Barbell Squat",
  ex_rdl: "Romanian Deadlift",
  ex_lunges: "Barbell Walking Lunge",
  ex_leg_curl: "Ball Leg Curl",
  ex_calf_raise: "Rocking Standing Calf Raise",
  ex_barbell_row: "Bent Over Barbell Row",
  ex_incline_bench: "Barbell Incline Bench Press - Medium Grip",
  ex_lateral_raise: "Side Lateral Raise", // updated mapping
  ex_cable_row: "Seated Cable Rows",
  ex_hammer_curl: "Alternate Hammer Curl",
  ex_skull_crusher: "EZ-Bar Skullcrusher",
  ex_deadlift: "Barbell Deadlift",
  ex_front_squat: "Front Squat (Clean Grip)",
  ex_hip_thrust: "Barbell Hip Thrust",
  ex_leg_extension: "Leg Extensions",
  ex_seated_calf_raise: "Barbell Seated Calf Raise",
  ex_biceps_curl: "Barbell Curl",
  ex_triceps_pushdown: "Triceps Pushdown",
};

async function run() {
  const imagesDir = path.join(process.cwd(), "public", "images", "exercises");
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const data = await fetchJson(
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json",
  );
  console.log(`Loaded ${data.length} exercises from remote DB.`);

  const defaultExercisesData = {};

  for (const [id, exactName] of Object.entries(map)) {
    const match = data.find((e) => e.name === exactName);
    if (!match) {
      console.log(
        `[!!] Could not find exercise matching exactly: ${exactName}`,
      );
      continue;
    }

    // Create a copy of the match data to embed, reset images
    const exerciseData = { ...match, images: [] };

    // We try to grab the first 2 images
    if (match.images && match.images.length > 0) {
      const imagesToFetch = match.images.slice(0, 2);
      for (let i = 0; i < imagesToFetch.length; i++) {
        const imgPath = imagesToFetch[i];
        const url = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${imgPath}`;
        const dest = path.join(imagesDir, `${id}_${i}.webp`);

        console.log(`Downloading and converting ${id}_${i}.webp...`);
        try {
          const buffer = await downloadImageBuffer(url);
          await sharp(buffer).webp({ quality: 80, effort: 6 }).toFile(dest);
          console.log(`[OK] Saved ${dest}`);

          exerciseData.images.push(`/images/exercises/${id}_${i}.webp`);

          // Remove the old JPG if we ran it previously
          const jpgDest = path.join(
            imagesDir,
            `${id}_${i}${path.extname(imgPath)}`,
          );
          if (fs.existsSync(jpgDest)) fs.unlinkSync(jpgDest);
        } catch (err) {
          console.error(
            `[!!] Failed downloading/converting ${url}:`,
            err.message,
          );
        }
      }
    } else {
      console.log(`[!!] Found ${exactName} but it has no images.`);
    }

    // Try to remove old single image file from previous runs
    const oldDest = path.join(imagesDir, `${id}.webp`);
    if (fs.existsSync(oldDest)) fs.unlinkSync(oldDest);

    defaultExercisesData[id] = exerciseData;
  }

  const tsContent = `// Auto-generated file\nexport const defaultExercisesData: Record<string, any> = ${JSON.stringify(defaultExercisesData, null, 2)};\n`;
  const dataDest = path.join(
    process.cwd(),
    "src",
    "lib",
    "defaultExercisesData.ts",
  );
  fs.writeFileSync(dataDest, tsContent, "utf-8");
  console.log(`[OK] Generated ${dataDest}`);
}

run();
