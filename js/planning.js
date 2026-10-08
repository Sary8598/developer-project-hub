"use strict";

/*
  DEVELOPER PROJECT HUB
  Guided Planning - Question Definitions

  Each planning step contains questions that help
  developers document their software projects.
*/

const planningQuestions = [
  {
    id: "overview",
    title: "Project Overview",
    description: "Define your project's purpose, target users, and main goals.",

    questions: [
      {
        id: "problem",
        label: "What problem does your application solve?",
        help:
          "Describe the need or difficulty that motivated your project. " +
          "Focus on the problem rather than the technical solution.",
        example:
          "I struggle to organize recurring payments and know how much " +
          "money to reserve from each paycheck.",
        type: "textarea",
      },
      {
        id: "purpose",
        label: "What is the main purpose of your application?",
        help: "Explain what you want the application to accomplish.",
        example: "Help users manage income, expenses, and upcoming payments.",
        type: "textarea",
      },
      {
        id: "audience",
        label: "Who will use your application?",
        help: "Identify your target users. You can start with yourself.",
        example: "People who want to organize their personal finances.",
        type: "textarea",
      },
      {
        id: "appType",
        label: "What type of application are you building?",
        help: "Choose the category that best describes your project.",
        type: "select",
        options: [
          { value: "", label: "Select an application type" },
          { value: "web", label: "Web Application" },
          { value: "mobile", label: "Mobile Application" },
          { value: "desktop", label: "Desktop Application" },
          { value: "website", label: "Static Website" },
          { value: "api", label: "API / Backend Service" },
          { value: "other", label: "Other / Undecided" },
        ],
      },
      {
        id: "goals",
        label: "What are your main project goals?",
        help: "List the most important outcomes you want to achieve.",
        example:
          "Register transactions, track recurring bills, and plan paydays.",
        type: "textarea",
      },
    ],
  },
];
