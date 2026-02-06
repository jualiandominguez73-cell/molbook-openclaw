cmake_minimum_required(VERSION 3.15)
project(UtilsService)

set(CMAKE_CXX_STANDARD 17)

find_package(Protobuf REQUIRED)
find_package(gRPC CONFIG REQUIRED)

include_directories(generated)

add_executable(utils_server
  server.cpp
  generated/utils.pb.cc
  generated/utils.grpc.pb.cc
)

target_link_libraries(utils_server
  gRPC::grpc++
  protobuf::libprotobuf
)
