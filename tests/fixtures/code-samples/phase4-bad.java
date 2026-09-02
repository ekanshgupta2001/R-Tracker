package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;

@Autonomous(name = "GuessAuto")
public class GuessAuto extends LinearOpMode {
    DcMotor left, right, lift;

    @Override
    public void runOpMode() {
        left = hardwareMap.get(DcMotor.class, "left_drive");
        right = hardwareMap.get(DcMotor.class, "right_drive");
        lift = hardwareMap.get(DcMotor.class, "lift");
        waitForStart();
        left.setPower(0.6); right.setPower(0.6); sleep(1500);
        lift.setPower(0.8); sleep(700);
        lift.setPower(0.1);
        left.setPower(0); right.setPower(0);
        telemetry.addData("done", true);
        telemetry.update();
    }
}
