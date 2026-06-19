/**
 * Visual Blocks Editor
 *
 * Copyright 2016 Massachusetts Institute of Technology
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as Blockly from 'blockly/core'

Blockly.Blocks.event_whenflagclicked = {
  init: function (this: Blockly.Block) {
    const ws = this.workspace.options.parentWorkspace ?? this.workspace
    this.jsonInit({
      id: 'event_whenflagclicked',
      message0: Blockly.Msg.EVENT_WHENFLAGCLICKED,
      args0: [
        {
          type: 'field_image',
          src: ws.options.pathToMedia + 'green-flag.svg',
          width: 24,
          height: 24,
          alt: 'flag',
        },
      ],
      extensions: ['colours_event', 'shape_hat'],
    })
  },
}

Blockly.Blocks.event_whenkeypressed = {
  init: function (this: Blockly.Block) {
    this.jsonInit({
      id: 'event_whenkeypressed',
      message0: Blockly.Msg.EVENT_WHENKEYPRESSED,
      args0: [
        {
          type: 'field_dropdown',
          name: 'KEY_OPTION',
          options: [
            [Blockly.Msg.EVENT_WHENKEYPRESSED_SPACE, 'space'],
            [Blockly.Msg.EVENT_WHENKEYPRESSED_UP, 'up arrow'],
            [Blockly.Msg.EVENT_WHENKEYPRESSED_DOWN, 'down arrow'],
            [Blockly.Msg.EVENT_WHENKEYPRESSED_RIGHT, 'right arrow'],
            [Blockly.Msg.EVENT_WHENKEYPRESSED_LEFT, 'left arrow'],
            [Blockly.Msg.EVENT_WHENKEYPRESSED_ANY, 'any'],
            ['a', 'a'],
            ['b', 'b'],
            ['c', 'c'],
            ['d', 'd'],
            ['e', 'e'],
            ['f', 'f'],
            ['g', 'g'],
            ['h', 'h'],
            ['i', 'i'],
            ['j', 'j'],
            ['k', 'k'],
            ['l', 'l'],
            ['m', 'm'],
            ['n', 'n'],
            ['o', 'o'],
            ['p', 'p'],
            ['q', 'q'],
            ['r', 'r'],
            ['s', 's'],
            ['t', 't'],
            ['u', 'u'],
            ['v', 'v'],
            ['w', 'w'],
            ['x', 'x'],
            ['y', 'y'],
            ['z', 'z'],
            ['0', '0'],
            ['1', '1'],
            ['2', '2'],
            ['3', '3'],
            ['4', '4'],
            ['5', '5'],
            ['6', '6'],
            ['7', '7'],
            ['8', '8'],
            ['9', '9'],
          ],
        },
      ],
      extensions: ['colours_event', 'shape_hat'],
    })
  },
}

Blockly.Blocks.event_whenarduinobegin = {
  init: function (this: Blockly.Block) {
    this.jsonInit({
      id: 'event_whenarduinobegin',
      message0: Blockly.Msg.EVENT_WHENARDUINOBEGIN,
      extensions: ['colours_event', 'shape_hat'],
    })
  },
}

Blockly.Blocks.event_whenarduinoloop = {
  init: function (this: Blockly.Block) {
    this.jsonInit({
      id: 'event_whenarduinoloop',
      message0: Blockly.Msg.EVENT_WHENARDUINOLOOP,
      extensions: ['colours_event', 'shape_hat'],
    })
  },
}
