import time
import cv2
from lerobot.cameras.opencv.configuration_opencv import OpenCVCameraConfig
import numpy as np
import copy
import threading

from lerobot.model.kinematics import RobotKinematics
from lerobot.processor import RobotAction, RobotObservation, RobotProcessorPipeline
from lerobot.processor.converters import (
    robot_action_observation_to_transition,
    transition_to_robot_action,
)
from lerobot.robots.so100_follower.config_so100_follower import SO100FollowerConfig
from lerobot.robots.so100_follower.robot_kinematic_processor import (
    EEBoundsAndSafety,
    EEReferenceAndDelta,
    GripperVelocityToJoint,
    InverseKinematicsEEToJoints,
)
from lerobot.robots.so100_follower.so100_follower import SO100Follower
from lerobot.teleoperators.phone.config_phone import PhoneConfig, PhoneOS
# from lerobot.teleoperators.phone.phone_processor import MapPhoneActionToRobotAction
from lerobot.teleoperators.phone.teleop_phone import Phone
from lerobot.utils.robot_utils import busy_wait
from lerobot.utils.visualization_utils import init_rerun, log_rerun_data

from vr_headset import VRHeadset
from vr_processor import MapVRActionToRobotAction
from webrtc_camera_server import create_camera_server

FPS = 30

# Initialize the robot and teleoperator
# Left Arm
left_camera_config = {
    "left_wrist": OpenCVCameraConfig(index_or_path=0, width=640, height=480, fps=FPS),
    "right_wrist": OpenCVCameraConfig(index_or_path=1, width=640, height=480, fps=FPS),
    "above": OpenCVCameraConfig(index_or_path=2, width=640, height=480, fps=FPS)
}
left_robot_config = SO100FollowerConfig(
    port="/dev/tty.usbmodem5A460842561", id="left_follower_arm", use_degrees=True, cameras=left_camera_config
)
# Right Arm
right_camera_config = {
    "right_wrist": OpenCVCameraConfig(index_or_path=1, width=640, height=480, fps=FPS)
}
right_robot_config = SO100FollowerConfig(
    port="/dev/tty.usbmodem58FA0963791", id="right_follower_arm", use_degrees=True, cameras=right_camera_config
)

# Initialize the robot and teleoperator
left_arm = SO100Follower(left_robot_config)
right_arm = SO100Follower(right_robot_config)
teleop_device = VRHeadset()

# Initialize WebRTC camera server
camera_server = create_camera_server()

# Start camera server in background thread
server_thread = threading.Thread(target=camera_server.run_in_thread, daemon=True)
server_thread.start()
print("🎥 WebRTC camera server started on http://0.0.0.0:8765")

# NOTE: It is highly recommended to use the urdf in the SO-ARM100 repo: https://github.com/TheRobotStudio/SO-ARM100/blob/main/Simulation/SO101/so101_new_calib.urdf
kinematics_solver = RobotKinematics(
    urdf_path="Simulation/SO101/so101_new_calib.urdf",
    target_frame_name="gripper_frame_link",
    joint_names=list(right_arm.bus.motors.keys()),
)

# Build pipeline to convert phone action to ee pose action to joint action
vr_to_left_arm_joints_processor = RobotProcessorPipeline[tuple[RobotAction, RobotObservation], RobotAction](
    steps=[
        MapVRActionToRobotAction(),
        EEReferenceAndDelta(
            kinematics=kinematics_solver,
            end_effector_step_sizes={"x": 0.5, "y": 0.5, "z": 0.5},
            motor_names=list(right_arm.bus.motors.keys()),
            use_latched_reference=True,
        ),
        EEBoundsAndSafety(
            end_effector_bounds={"min": [-1.0, -1.0, -1.0], "max": [1.0, 1.0, 1.0]},
            max_ee_step_m=0.20,
        ),
        GripperVelocityToJoint(
            speed_factor=20.0,
        ),
        InverseKinematicsEEToJoints(
            kinematics=kinematics_solver,
            motor_names=list(right_arm.bus.motors.keys()),
            initial_guess_current_joints=True,
        ),
    ],
    to_transition=robot_action_observation_to_transition,
    to_output=transition_to_robot_action,
)

vr_to_right_arm_joints_processor = RobotProcessorPipeline[tuple[RobotAction, RobotObservation], RobotAction](
    steps=[
        MapVRActionToRobotAction(),
        EEReferenceAndDelta(
            kinematics=kinematics_solver,
            end_effector_step_sizes={"x": 0.5, "y": 0.5, "z": 0.5},
            motor_names=list(right_arm.bus.motors.keys()),
            use_latched_reference=True,
        ),
        EEBoundsAndSafety(
            end_effector_bounds={"min": [-1.0, -1.0, -1.0], "max": [1.0, 1.0, 1.0]},
            max_ee_step_m=0.20,
        ),
        GripperVelocityToJoint(
            speed_factor=20.0,
        ),
        InverseKinematicsEEToJoints(
            kinematics=kinematics_solver,
            motor_names=list(right_arm.bus.motors.keys()),
            initial_guess_current_joints=True,
        ),
    ],
    to_transition=robot_action_observation_to_transition,
    to_output=transition_to_robot_action,
)

# Connect to the robot and teleoperator
left_arm.connect()
right_arm.connect()
teleop_device.connect()

# TODO remove - test camera frames
right_wrist_frame = right_arm.cameras["right_wrist"].async_read(timeout_ms=200)
cv2.imwrite("right_wrist_frame.jpg", right_wrist_frame)
left_wrist_frame = left_arm.cameras["left_wrist"].async_read(timeout_ms=200)
cv2.imwrite("left_wrist_frame.jpg", left_wrist_frame)

# Init rerun viewer
init_rerun(session_name="vr_lerobot_duo_teleop")

if not right_arm.is_connected or not left_arm.is_connected or not teleop_device.is_connected:
    raise ValueError("Robot or teleop is not connected!")

# first_pos = [0.0, 0.0, 0.0]
# enabled_first_pos = False


print("Starting teleop loop. Move your phone to teleoperate the robot...")
while True:
    t0 = time.perf_counter()

    # Get robot observation
    right_arm_obs = right_arm.get_observation()
    left_arm_obs = left_arm.get_observation()
    # robot_obs = {'shoulder_pan.pos': 1.3186813186813187, 'shoulder_lift.pos': -20.703296703296704, 'elbow_flex.pos': 8.131868131868131, 'wrist_flex.pos': 60.35164835164835, 'wrist_roll.pos': 8.483516483516484, 'gripper.pos': 1.2303485987696514}

    # Capture and stream camera frames
    try:
        # Get frames from cameras
        left_wrist_frame = left_arm.cameras["left_wrist"].async_read(timeout_ms=50)
        right_wrist_frame = right_arm.cameras["right_wrist"].async_read(timeout_ms=50)
        above_frame = left_arm.cameras["above"].async_read(timeout_ms=50)
        
        # Update WebRTC streams
        if left_wrist_frame is not None:
            camera_server.update_camera_frame("left_wrist", left_wrist_frame)
        if right_wrist_frame is not None:
            camera_server.update_camera_frame("right_wrist", right_wrist_frame)
        if above_frame is not None:
            camera_server.update_camera_frame("above", above_frame)
            
    except Exception as e:
        print(f"Error capturing camera frames: {e}")

    # Get teleop action
    vr_obs = teleop_device.last_observation

    if vr_obs is None:
        print("No VR observation received yet.")
        log_rerun_data(observation=left_arm_obs, action=None)
    else:
        print("VR Observation: ", vr_obs)

        right_controller_obs = copy.deepcopy(vr_obs["right"])
        # print(f"VR Observation: {right_controller_obs}")

        if right_controller_obs["enabled"]:
            print(f"Right Arm VR Position: {right_controller_obs['pos']}")
        else:
            print("Right controller not enabled.")

        right_joint_action = vr_to_right_arm_joints_processor((right_controller_obs, right_arm_obs))
        _ = right_arm.send_action(right_joint_action)


        left_controller_obs = copy.deepcopy(vr_obs["left"])
        # print(f"VR Observation: {left_controller_obs}")

        if left_controller_obs["enabled"]:
            print(f"Left Arm VR Position: {left_controller_obs['pos']}")
        else:
            print("Left controller not enabled.")

        left_joint_action = vr_to_left_arm_joints_processor((left_controller_obs, left_arm_obs))
        _ = left_arm.send_action(left_joint_action)

        # if right_controller_obs["enabled"]:
        #     if not enabled_first_pos:
        #         first_pos = right_controller_obs["pos"]
        #         enabled_first_pos = True
        #         print(f"First position recorded: {first_pos}")
            
        #     # print(f"Original VR Position: {right_controller_obs['pos']}")
        #     # delta_pos = np.array(right_controller_obs["pos"]) - np.array(first_pos)
        #     # right_controller_obs["pos"] = delta_pos.tolist()
        #     # print(f"VR Observation: {right_controller_obs}")

        #     # Phone -> EE pose -> Joints transition
        #     joint_action = phone_to_robot_joints_processor((right_controller_obs, robot_obs))

        #     # print(f"Robot Observation: {robot_obs}")
        #     # print(f"Joint Action: {joint_action}")

        #     # Send action to robot
        #     _ = right_arm.send_action(joint_action)
        # else:
        #     enabled_first_pos = False
        #     first_pos = [0.0, 0.0, 0.0]
        #     print("VR controller not enabled.")

        # # Visualize
        # log_rerun_data(observation=left_arm_obs, action=left_joint_action)

    busy_wait(max(1.0 / FPS - (time.perf_counter() - t0), 0.0))


