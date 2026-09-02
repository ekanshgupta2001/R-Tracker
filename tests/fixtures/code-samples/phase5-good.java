package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;
import com.pedropathing.follower.Follower;

class Intake {
    private DcMotor motor;
    public Intake(HardwareMap hardwareMap) { motor = hardwareMap.get(DcMotor.class, "intake"); }
    public void run(double power) { motor.setPower(power); }
}

@Autonomous(name = "FixedAuto")
public class FixedAuto extends LinearOpMode {
    enum State { FOLLOW, INTAKE, DONE }
    private State state = State.FOLLOW;
    private Follower follower;
    private Intake intake;

    @Override
    public void runOpMode() {
        follower = new Follower(hardwareMap);
        intake = new Intake(hardwareMap);
        waitForStart();

        while (opModeIsActive()) {
            // BUG 1 (fixed): follower.update() was called twice per loop, so the localizer
            // integrated every encoder delta twice and the heading drifted. Telemetry showed the
            // reported x doubling the wheel travel; now update() runs exactly once here.
            follower.update();

            switch (state) {
                case FOLLOW:
                    // BUG 2 (fixed): the transition used follower.isBusy() == true, which is backwards;
                    // the robot went to INTAKE immediately because isBusy() was true while driving.
                    if (!follower.isBusy()) { state = State.INTAKE; }
                    break;
                case INTAKE:
                    intake.run(1.0);
                    // BUG 3 (fixed): the silent return below skipped the DONE transition, so the intake
                    // never stopped. I isolated it by adding the "State" telemetry line and watching it
                    // stay on INTAKE forever. Verified the fix over 5 runs.
                    if (getRuntime() > 25) { intake.run(0); state = State.DONE; }
                    break;
                case DONE:
                    break;
            }

            telemetry.addData("State", state);
            telemetry.addData("Busy", follower.isBusy());
            telemetry.addData("Runtime", getRuntime());
            telemetry.update();
        }
    }
}
