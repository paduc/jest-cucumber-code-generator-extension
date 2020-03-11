import { parseFeature, generateCodeFromFeature } from 'jest-cucumber'
import * as vscode from 'vscode'
import * as gherkinLanguages from '../gherkin-languages.js'
import formatter from './formatter'

const STEP_KEYWORDS = ['given', 'when', 'then', 'and', 'but']
function translateSteps(feature, lang) {
  vscode.window.showInformationMessage('Calling translateSteps')

  const language = gherkinLanguages[lang]
  if (!language) {
    vscode.window.showErrorMessage('Cannot find language in gherkin')
    return
  }

  // vscode.window.showInformationMessage(
  //   'gherkin language is ' + JSON.stringify(language, null, 2)
  // )

  const stepsInLanguage = STEP_KEYWORDS.reduce((keywordMap, stepKeyword) => {
    language[stepKeyword].forEach(keywordInLanguage => {
      if (keywordInLanguage.indexOf('*') === -1) {
        keywordMap[keywordInLanguage.toLowerCase().trimRight()] = stepKeyword
      }
    })

    return keywordMap
  }, {})

  // vscode.window.showInformationMessage(
  //   'steps in language are ' + JSON.stringify(stepsInLanguage, null, 2)
  // )

  const translatedScenarios = feature.scenarios.map(scenario => {
    const translatedSteps = scenario.steps.map(step => {
      // try to translate the keyword from language to english
      const translatedKeyword = stepsInLanguage[step.keyword] || step.keyword
      // vscode.window.showInformationMessage(
      //   'looking for "' + step.keyword + '" and found ' + translatedKeyword
      // )
      return { ...step, keyword: translatedKeyword }
    })

    return { ...scenario, steps: translatedSteps }
  })

  return { ...feature, scenarios: translatedScenarios }
}

const LANGUAGE_HEADER = '# language: '
function generateCommandsFromFeatureAsText(
  featureAsText,
  selectionInformation
) {
  const firstLineEndIndex = featureAsText.indexOf('\n')
  const firstLine = featureAsText.substring(0, firstLineEndIndex)
  let language
  const languageIndex = firstLine.indexOf(LANGUAGE_HEADER)
  if (languageIndex === 0) {
    language = firstLine.substring(LANGUAGE_HEADER.length, firstLineEndIndex)
  }
  // vscode.window.showInformationMessage('feature language:' + language)
  let feature = parseFeature(featureAsText)

  if (language) {
    const translatedFeature = translateSteps(feature, language)
    // vscode.window.showInformationMessage(
    //   'Translating to language ' +
    //     language +
    //     ' and translatedFeature are ' +
    //     (translatedFeature
    //       ? JSON.stringify(translatedFeature, null, 2)
    //       : 'undefined')
    // )

    if (translatedFeature) feature = translatedFeature
  }

  // vscode.window.showInformationMessage(
  //   'features have been parsed to ' + JSON.stringify(feature, null, 2)
  // )
  if (areScenariosPresentIn(feature)) {
    return generateCommands(feature, selectionInformation)
  }
}
function areScenariosPresentIn(feature) {
  return feature.scenarios.length + feature.scenarioOutlines.length > 0
}
function generateCommands(feature, selectionInformation) {
  if (isFeatureIn(selectionInformation)) {
    return generateFeatureCommands(feature)
  }
  if (isScenarioIn(selectionInformation)) {
    return generateScenarioCommands(feature, selectionInformation)
  }
  if (isStepIn(selectionInformation)) {
    return generateStepsCommands(feature, selectionInformation)
  }
}
function isFeatureIn(selectionInformation) {
  return selectionInformation.start === 1
}
function isScenarioIn(selectionInformation) {
  return selectionInformation.text.toLowerCase().includes('scenario:')
}
function isStepIn(selectionInformation) {
  return !selectionInformation.text.toLowerCase().includes('scenario:')
}
function generateFeatureCommands(feature) {
  let commands = []
  commands = generateCommandsFrom(feature)

  return formatter.format(commands, true)
}
function generateScenarioCommands(feature, selectionInformation) {
  let commands = []
  feature.scenarios = filterScenariosFrom(
    feature.scenarios,
    selectionInformation
  )
  feature.scenarioOutlines = filterScenariosFrom(
    feature.scenarioOutlines,
    selectionInformation
  )
  commands = generateCommandsFrom(feature)

  return formatter.format(commands, false)
}
function filterScenariosFrom(scenarios, selectionInformation) {
  return scenarios.filter(scenario => {
    const { lineNumber } = scenario
    const { start, end } = selectionInformation

    return lineNumber >= start && lineNumber <= end
  })
}
function generateCommandsFrom(feature) {
  return feature.scenarios
    .concat(feature.scenarioOutlines)
    .sort((a, b) => Math.sign(a.lineNumber - b.lineNumber))
    .map(scenario => generateCodeFromFeature(feature, scenario.lineNumber))
}
function generateStepsCommands(feature, selectionInformation) {
  const commands = []
  const { start, end } = selectionInformation
  for (var i = start; i <= end; i++) {
    const command = generateCodeFromFeature(feature, i)
    commands.push(command)
  }

  return formatter.format(commands, false)
}

export default {
  generateCommandsFromFeatureAsText
}
