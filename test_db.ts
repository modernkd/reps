import { getExerciseByName } from "./src/lib/exerciseDb";

async function main() {
  const ex1 = await getExerciseByName("Back Squat");
  console.log("Back Squat ->", ex1?.name, ex1?.id);
  
  const ex2 = await getExerciseByName("ex_back_squat");
  console.log("ex_back_squat ->", ex2?.name, ex2?.id);
}
main();
