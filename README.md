# Cartographer

Cartographer is a tool for statically analyzing javascript resources to identify and recursively resolve requirement dependencies. It is meant to be used as part of a larger build process that requires the dependencies of a given file in order to properly pack files in load order.

I hope for this to be the first piece of a more flexible system to allow for arbitrary packed file construction with shared dependencies that can be loaded async from one another.