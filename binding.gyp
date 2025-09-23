{
  "targets": [
    {
      "target_name": "eventkit",
      "sources": [ "src/native/eventkit.mm" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "cflags_cc": [ "-std=c++17", "-fobjc-arc" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "OTHER_CFLAGS": [ "-mmacosx-version-min=10.13" ],
        "OTHER_CPLUSPLUSFLAGS": [ "-std=c++17", "-stdlib=libc++", "-fobjc-arc" ]
      },
      "msvs_settings": {
        "VCCLCompilerTool": { "ExceptionHandling": 1 }
      },
      "conditions": [
        [ 'OS=="mac"', {
          "link_settings": {
            "libraries": [
              "-framework EventKit",
              "-framework Foundation",
              "-framework AppKit"
            ]
          }
        }]
      ]
    }
  ]
}
