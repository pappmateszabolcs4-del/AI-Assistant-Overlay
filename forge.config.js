module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'AIGameAssistant'
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'aigameassistant',
        authors: 'AI Game Assistant',
        description: 'AI Game Assistant - gaming overlay with AI help'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'AIGameAssistant'
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          maintainer: 'AIGameAssistant'
        }
      }
    }
  ]
};
