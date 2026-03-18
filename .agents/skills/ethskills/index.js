const fs = require('fs');
const path = require('path');

// Load the entire knowledge base as a string
function loadContent() {
  const skillMdPath = path.join(__dirname, 'SKILL.md');
  return fs.readFileSync(skillMdPath, 'utf8');
}

const fullContent = loadContent();

module.exports = {
  name: 'ethskills',
  version: '1.0.0',

  skills: {
    getFullGuide: {
      description: 'Get the complete ethskills guide (all Ethereum knowledge)',
      parameters: { type: 'object', properties: {} }
    },
    search: {
      description: 'Search the ethskills guide for a keyword',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term (case-insensitive)' }
        },
        required: ['query']
      }
    }
  },

  // Implementations
  getFullGuide() {
    return {
      success: true,
      content: fullContent,
      size: fullContent.length,
      note: 'This is the full ethskills markdown guide. Parse or search as needed.'
    };
  },

  search({ query }) {
    const lowerQ = query.toLowerCase();
    const lines = fullContent.split('\n');
    const matches = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lowerQ)) {
        matches.push({
          line: i + 1,
          text: lines[i].trim()
        });
        if (matches.length >= 20) break; // limit results
      }
    }
    return {
      success: true,
      query,
      matches,
      count: matches.length,
      hint: 'Use getFullGuide to retrieve full context'
    };
  }
};
