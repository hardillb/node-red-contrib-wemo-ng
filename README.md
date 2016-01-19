# node-red-nodes-wemo

A better Node-RED node for working with Belkin WeMo devices

## Output node

The output node switches a socket, a light or group of lights on or off

This should be backward compatible with the pervious version of this node but will benefit 
from opening the config dialog and selecting the node you want.

The node accecpts the following inputs

 * Strings on/off
 * integers 1/0
 * boolean true/false
 * an Object like this (lights only, coming soon)
 ```
     {
       state: 1,
       dim: 255,
       color: '255,255,255',
       temperature: 25000
    }
 ```

## Input Node

The new input node is now based on uPnP notifications instead of polling. This means messages
will only be set when an actual change occurs in on the device. This means the node will not 
send regular no-change messages.

The output varies depending on the type of device but examples for sockets look like this:

