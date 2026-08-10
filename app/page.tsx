"use client";

import Image from "next/image";
import ai1 from "../public/ai1.png";
import ai2 from "../public/ai2.png";
import ai3 from "../public/ai3.png";
import ai4 from "../public/ai4.png";
import ai5 from "../public/ai5.png";
import real1 from "../public/real1.png";
import real2 from "../public/real2.png";
import real3 from "../public/real3.png";
import real4 from "../public/real4.png";
import real5 from "../public/real5.png";
import { useState } from "react";

const levels = {
	"1": {
		id: "1",
		real: real1,
		ai: ai1,
		aiOnLeft: false,
	},
	"2": {
		id: "2",
		real: real2,
		ai: ai2,
		aiOnLeft: true,
	},
	"3": {
		id: "3",
		real: real3,
		ai: ai3,
		aiOnLeft: false,
	},
	"4": {
		id: "4",
		real: real4,
		ai: ai4,
		aiOnLeft: false,
	},
	"5": {
		id: "5",
		real: real5,
		ai: ai5,
		aiOnLeft: true,
	},
};

export default function Home() {
	type AnswerId = "1" | "2" | "3" | "4" | "5";
	type Answer = {
		answer: boolean | null;
		locked: boolean;
	};

	const [answers, setAnswers] = useState<Record<AnswerId, Answer | null>>({
		"1": { answer: null, locked: false },
		"2": { answer: null, locked: false },
		"3": { answer: null, locked: false },
		"4": { answer: null, locked: false },
		"5": { answer: null, locked: false },
	});
	const [score, setScore] = useState(0);

	function setAnswer(id: AnswerId, correct: boolean) {
		if (answers[id]?.locked !== true) {
			setAnswers((previous) => ({
				...previous,
				[id]: { answer: correct, locked: true },
			}));
			if (correct) {
				setScore(score + 1);
			}
		} else {
			alert("You can not change your answer");
		}
	}

	return (
		<div className="flex flex-col text-center justify-center">
			<h1 className="text-2xl font-bold">Pick the AI image:</h1>
			<p>
				The images are devided in to 5 rows of 2 images, one of the images is real and one
				is{" "}
			</p>
			{Object.entries(levels).map(([number, level]) => (
				<div
					key={number}
					className={`flex flex-row gap-2 mx-auto mt-2 p-2 rounded-3xl border-2 ${answers[number as AnswerId]?.answer === null ? "border-gray-200" : answers[number as AnswerId]?.answer === true ? "border-green-600 bg-green-950" : "border-red-600 bg-red-950"}`}
				>
					<Image
						id="image 1"
						src={level.aiOnLeft ? level.ai : level.real}
						width={400}
						height={400}
						alt="ai1"
						onClick={() => setAnswer(level.id as AnswerId, level.aiOnLeft ? true : false)}
						className={`rounded-2xl border-2 ${level.aiOnLeft ? (answers[number as AnswerId]?.answer === null ? "border-gray-200" : "border-green-600") : "border-gray-200"} ${(answers[number as AnswerId]?.answer === true || answers[number as AnswerId]?.answer === false) && !level.aiOnLeft ? "mix-blend-multiply" : ""}`}
					/>
					<Image
						id="image"
						src={level.aiOnLeft ? level.real : level.ai}
						width={400}
						height={400}
						alt="ai2"
						onClick={() => setAnswer(level.id as AnswerId, level.aiOnLeft ? false : true)}
						className={`rounded-2xl border-2 ${level.aiOnLeft ? "border-gray-200" : answers[number as AnswerId]?.answer === null ? "border-gray-200" : "border-green-600"} ${(answers[number as AnswerId]?.answer === true || answers[number as AnswerId]?.answer === false) && level.aiOnLeft ? "mix-blend-multiply" : ""}`}
					/>
				</div>
			))}
			<div className="fixed bottom-0 right-0 bg-[#202020] rounded-tl-2xl p-3">
				<p>Score: {score}/5</p>
			</div>
		</div>
	);
}
