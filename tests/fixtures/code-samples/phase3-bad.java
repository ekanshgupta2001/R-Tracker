package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;

@Autonomous(name = "TimeAuto")
public class TimeAuto extends LinearOpMode {
    DcMotor left, right;

    @Override
    public void runOpMode() {
        left = hardwareMap.get(DcMotor.class, "left_drive");
        right = hardwareMap.get(DcMotor.class, "right_drive");
        waitForStart();
        left.setPower(0.5); right.setPower(0.5); sleep(2000);
        left.setPower(0); right.setPower(0); sleep(500);
        left.setPower(-0.5); right.setPower(0.5); sleep(800);
        left.setPower(0); right.setPower(0);
    }
}
